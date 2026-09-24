#!/usr/bin/env python3
import argparse, importlib.util, json, os, pathlib, sys, time, urllib.parse, urllib.request, secrets
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'src'))

def loadmod(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/'src'/path); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
market_store=loadmod('market_store','market-store.py')
finance_store=loadmod('finance_store','finance-store.py')
market_catalog=loadmod('market_catalog','market-catalog.py')
pq_crypto=loadmod('pq_crypto','pq_crypto.py')
keeper=loadmod('keeper','keeper.py')
settlement_engine=loadmod('settlement_engine','settlement-engine.py')
agent_vault=loadmod('agent_vault','agent_vault.py')
payment_fabric=loadmod('payment_fabric','payment_fabric.py')
iso20022=loadmod('iso20022','iso20022_bridge.py')
auth=loadmod('auth','auth.py')
solana_finance=loadmod('solana_finance','solana_finance.py')
card_rail=loadmod('card_rail','card_rail.py')
lending=loadmod('lending','lending.py')
simulations=loadmod('simulations','simulations.py')
growth=loadmod('growth','growth.py')
market_execution=loadmod('market_execution','market_execution.py')
clawpump=loadmod('clawpump','clawpump.py')
equity_os=loadmod('equity_os','equity_os.py')
kamino=loadmod('kamino_adapter','kamino_adapter.py')
xstocks=loadmod('xstocks_adapter','xstocks_adapter.py')
accounting_tokens=loadmod('accounting_tokens','accounting_tokens.py')

SNAPSHOT=json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text())
USDC_MINT=os.getenv('STOCKLANA_USDC_MINT','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
SOLANA_RPC=os.getenv('SOLANA_RPC_URL','https://api.mainnet-beta.solana.com')
VAULT_ADDRESS=os.getenv('STOCKLANA_VAULT_ADDRESS','')
PROGRAM_ID=os.getenv('STOCKLANA_PROGRAM_ID','')
_ASSET_CACHE={'at':0.0,'data':SNAPSHOT}

def normalized_live_assets():
    now=time.time()
    if now-_ASSET_CACHE['at']<30 and _ASSET_CACHE['data']:
        return _ASSET_CACHE['data']
    try:
        req=urllib.request.Request('https://prestocks.com/api/prestocks',headers={'User-Agent':'Stocklana/0.4'})
        with urllib.request.urlopen(req,timeout=2) as r: data=json.loads(r.read().decode())
        if isinstance(data,list) and data:
            _ASSET_CACHE.update({'at':now,'data':data}); return data
    except Exception:
        pass
    _ASSET_CACHE.update({'at':now,'data':SNAPSHOT}); return SNAPSHOT

def ensure_seed_markets():
    existing={m['id'] for m in market_store.list_markets()}
    for i,t in enumerate(market_catalog.templates(SNAPSHOT)[:96]):
        mid=f'seed_{i+1:03d}'
        if mid in existing: continue
        try:
            market_store.create_market({**t,'id':mid,'resolveAt':'2027-06-30','liquidity':1000,'creator':'stocklana.market.factory','feeBps':100})
        except Exception: pass

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self,path):
        raw=super().translate_path(path); rel=os.path.relpath(raw,os.getcwd()); return str(ROOT/rel)
    def body(self):
        n=int(self.headers.get('Content-Length','0') or 0); raw=self.rfile.read(n) if n else b'{}'; return json.loads(raw.decode() or '{}')
    def trader(self,qs=None,payload=None):
        header=self.headers.get('Authorization','')
        token=header[7:] if header.startswith('Bearer ') else self.headers.get('X-Stocklana-Session','')
        rec=auth.resolve(token) if token else None
        if rec: return rec['subject']
        if os.getenv('STOCKLANA_DEV_AUTH')=='1':
            if payload and payload.get('trader'): return payload['trader']
            if qs and qs.get('trader'): return qs['trader'][0]
            return 'guest'
        raise ValueError('authentication_required')
    def rpc(self,method,params):
        body=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode()
        req=urllib.request.Request(SOLANA_RPC,data=body,headers={'content-type':'application/json','User-Agent':'Stocklana/0.3'})
        with urllib.request.urlopen(req,timeout=12) as r: return json.loads(r.read().decode())
    def verify_usdc_deposit(self,signature,expected_amount,expected_sender=None):
        if not VAULT_ADDRESS: raise ValueError('vault_address_not_configured')
        j=self.rpc('getTransaction',[signature,{'encoding':'jsonParsed','commitment':'confirmed','maxSupportedTransactionVersion':0}])
        tx=j.get('result')
        if not tx: raise ValueError('deposit_transaction_not_found')
        meta=tx.get('meta') or {}; pre=meta.get('preTokenBalances') or []; post=meta.get('postTokenBalances') or []
        if meta.get('err') is not None: raise ValueError('deposit_transaction_failed')
        def bal(rows):
            total=0.0
            for r in rows:
                if r.get('mint')==USDC_MINT and r.get('owner')==VAULT_ADDRESS:
                    total+=float(((r.get('uiTokenAmount') or {}).get('uiAmountString')) or 0)
            return total
        delta=bal(post)-bal(pre)
        if delta+1e-6<float(expected_amount): raise ValueError('deposit_amount_not_verified')
        sender_delta=None
        if expected_sender:
            def owner_bal(rows, owner):
                total=0.0
                for r in rows:
                    if r.get('mint')==USDC_MINT and r.get('owner')==owner:
                        total+=float(((r.get('uiTokenAmount') or {}).get('uiAmountString')) or 0)
                return total
            sender_delta=owner_bal(post,expected_sender)-owner_bal(pre,expected_sender)
            if sender_delta > -float(expected_amount)+1e-6: raise ValueError('deposit_sender_not_verified')
        return {'signature':signature,'verifiedAmount':delta,'senderDelta':sender_delta,'sender':expected_sender,'slot':tx.get('slot')}
    def verify_usdc_withdrawal(self,signature,expected_amount,destination):
        if not VAULT_ADDRESS: raise ValueError('vault_address_not_configured')
        j=self.rpc('getTransaction',[signature,{'encoding':'jsonParsed','commitment':'confirmed','maxSupportedTransactionVersion':0}])
        tx=j.get('result')
        if not tx: raise ValueError('withdrawal_transaction_not_found')
        meta=tx.get('meta') or {}
        if meta.get('err') is not None: raise ValueError('withdrawal_transaction_failed')
        pre=meta.get('preTokenBalances') or []; post=meta.get('postTokenBalances') or []
        def owner_bal(rows,owner):
            total=0.0
            for r in rows:
                if r.get('mint')==USDC_MINT and r.get('owner')==owner:
                    total+=float(((r.get('uiTokenAmount') or {}).get('uiAmountString')) or 0)
            return total
        vault_delta=owner_bal(post,VAULT_ADDRESS)-owner_bal(pre,VAULT_ADDRESS)
        dest_delta=owner_bal(post,destination)-owner_bal(pre,destination)
        if vault_delta > -float(expected_amount)+1e-6: raise ValueError('withdrawal_vault_debit_not_verified')
        if dest_delta+1e-6 < float(expected_amount): raise ValueError('withdrawal_destination_credit_not_verified')
        return {'signature':signature,'verifiedAmount':dest_delta,'vaultDelta':vault_delta,'destination':destination,'slot':tx.get('slot')}

    def do_GET(self):
        u=urllib.parse.urlparse(self.path); path=u.path; qs=urllib.parse.parse_qs(u.query)
        if path=='/api/config': return self.send_json({'network':'solana-mainnet','vaultAddress':VAULT_ADDRESS or None,'usdcMint':USDC_MINT,'programId':PROGRAM_ID or None,'programDeployed':bool(PROGRAM_ID),'rpcConfigured':bool(SOLANA_RPC),'rpcUrl':SOLANA_RPC})
        if path=='/api/health': return self.send_json({'ok':True,'service':'stocklana','mode':'market-clearing-vault','marketLifecycle':['create','quote','trade','transfer-position','resolve','redeem'],'finance':['vault','internal-transfer','receipts','onramp-routing'],'crypto':pq_crypto.public_metadata()})
        if path=='/api/systems': return self.send_json({'count':9,'systems':[{'id':'markets','name':'PreStocks Market Factory','status':'active'},{'id':'clearing','name':'PARRALAX-derived Clearing Layer','status':'active'},{'id':'vault','name':'Stocklana Vault','status':'active'},{'id':'accounting','name':'Double-entry Financial Token Digest','status':'active'},{'id':'token-profiles','name':'V2 Token-2022 Financial Receipts','status':'wallet-signature-ready'},{'id':'solana','name':'Solana Wallet Rail','status':'client-ready'},{'id':'launcher','name':'Launch Router','status':'active'},{'id':'oracle','name':'Settlement Oracle','status':'adapter-ready'},{'id':'proof','name':'Phantasma PQ Receipts','status':'active'}]})
        if path=='/api/v2/home':
            live=normalized_live_assets(); ms=market_store.list_markets();
            payload={'version':'2.0','network':'solana-mainnet','actions':['BUY','AUTO_INVEST','BORROW','PLAY_MARKET','SEND','SPEND','AGENT','LAUNCH'],'equities':live[:8],'marketCount':len(ms),'agentVaultCount':len(agent_vault.list_agent_vaults()),'financialTokenStandard':'TOKEN_2022','accounting':accounting_tokens.snapshot().get('invariants',{})}
            try:
                who=self.trader(qs=qs); a=finance_store.account(who); pos=market_store.all_positions(who); payload['account']={'subject':who,'balances':a.get('balances',{}),'subaccounts':a.get('subaccounts',{}),'positions':len(pos)}
            except Exception: payload['account']=None
            return self.send_json(payload)
        if path=='/api/maque': return self.send_json({**payment_fabric.capabilities(),'solana':solana_finance.capabilities()})
        if path=='/api/solana-finance': return self.send_json(solana_finance.capabilities())
        if path=='/api/iso20022': return self.send_json(iso20022.capabilities())
        if path=='/api/card-rail': return self.send_json(card_rail.capabilities())
        if path=='/api/lending': return self.send_json(lending.capabilities())
        if path=='/api/simulations': return self.send_json(simulations.capabilities())
        if path=='/api/growth': return self.send_json(growth.capabilities())
        if path=='/api/clawpump': return self.send_json(clawpump.capabilities())
        if path=='/api/equity-os': return self.send_json(equity_os.capabilities())
        if path=='/api/track-fit': return self.send_json(json.loads((ROOT/'data'/'track-fit.json').read_text()))
        if path=='/api/kamino': return self.send_json(kamino.capabilities())
        if path=='/api/xstocks': return self.send_json(xstocks.capabilities())
        if path.startswith('/api/xstocks/asset/'):
            symbol=path.rsplit('/',1)[-1]; return self.send_json(xstocks.asset(symbol))
        if path.startswith('/api/xstocks/price/'):
            symbol=path.rsplit('/',1)[-1]; return self.send_json(xstocks.price_data(symbol))
        if path=='/api/equity/actions': return self.send_json({'actions':equity_os.corporate_actions((qs.get('symbol') or [None])[0])})
        if path=='/api/meteora': return self.send_json({'dbc':True,'sdk':'@meteora-ag/dynamic-bonding-curve-sdk@1.5.11','clientModule':'/src/meteora-dbc.js','programId':'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN','migration':'DAMM_V2','stockQuoted':True})
        if path=='/api/conservation': return self.send_json(finance_store.conservation())
        if path=='/api/accounting/tokens': return self.send_json(accounting_tokens.snapshot())
        if path=='/api/accounting/registry': return self.send_json(accounting_tokens.registry())
        if path=='/api/accounting/me': return self.send_json(accounting_tokens.financial_digest(self.trader(qs=qs)))
        if path.startswith('/api/markets/') and path.endswith('/solvency'):
            mid=path.split('/')[3]; return self.send_json(market_execution.solvency(mid))
        if path=='/api/requirements': return self.send_json(json.loads((ROOT/'data'/'requirements-ledger.json').read_text()))
        if path=='/api/bounty-coverage': return self.send_json(json.loads((ROOT/'data'/'bounty-coverage.json').read_text()))
        if path=='/api/agent-vaults':
            vs=agent_vault.list_agent_vaults(); public=[{'vaultId':v['vaultId'],'agentId':v['agentId'],'name':v['name'],'status':v['status'],'crypto':v['crypto']['suite'],'connectors':list(v['connectors'].keys()),'financialTokens':v.get('financialTokens',{}),'policy':{'dailySpendLimitUSDC':v['policy']['dailySpendLimitUSDC'],'humanApprovalAboveUSDC':v['policy']['humanApprovalAboveUSDC']}} for v in vs]
            return self.send_json({'count':len(public),'vaults':public})
        if path=='/api/markets': return self.send_json(market_store.list_markets())
        if path=='/api/market-templates': return self.send_json(market_catalog.templates(normalized_live_assets()))
        if path=='/api/market-universe':
            ts=market_catalog.templates(normalized_live_assets()); fam={}
            for t in ts: fam[t['family']]=fam.get(t['family'],0)+1
            return self.send_json({'templateCount':len(ts),'families':fam,'seedTarget':96,'underlyingCount':len(normalized_live_assets())})
        if path.startswith('/api/position/'):
            mid=path.split('/')[-1]; trader=self.trader(qs=qs); return self.send_json(market_store.position(mid,trader))
        if path=='/api/positions': return self.send_json(market_store.all_positions(self.trader(qs=qs)))
        if path=='/api/vault': return self.send_json(finance_store.account(self.trader(qs=qs)))
        if path.startswith('/api/vault/withdrawals/'):
            wid=path.split('/')[-1]; w=finance_store.withdrawal(wid); return self.send_json(w if w else {'error':'withdrawal_not_found'},200 if w else 404)
        if path=='/api/receipts': return self.send_json(finance_store.receipts((qs.get('limit') or ['50'])[0]))
        if path=='/api/crypto': return self.send_json(pq_crypto.public_metadata())
        if path=='/api/oracle/prestocks':
            o=settlement_engine.fetch_prestocks(); return self.send_json({'source':o['source'],'live':o.get('live',False),'fetchedAt':o['fetchedAt'],'assetCount':len(o['assets'])})
        if path=='/api/keeper/status': return self.send_json({'automaticSettlement':True,'livePreStocksRequired':True,'authenticated':bool(os.getenv('STOCKLANA_KEEPER_TOKEN'))})
        if path=='/ledger.csv':
            return super().do_GET()
        if path=='/api/funding/providers':
            return self.send_json({'providers':[
                {'id':'stripe','label':'Debit card / bank via Stripe Crypto Onramp','network':'solana','asset':'USDC','ready':bool(os.getenv('STRIPE_ONRAMP_URL'))},
                {'id':'coinbase','label':'Debit card / ACH via Coinbase Onramp','network':'solana','asset':'USDC','ready':bool(os.getenv('COINBASE_ONRAMP_URL'))},
                {'id':'wallet','label':'Deposit from Solana wallet','network':'solana','asset':'USDC','ready':True}
            ]})
        if path=='/api/commands': return self.send_json({'commands':[{'id':1,'type':'focus','target':'markets'}]})
        if path=='/api/certification': return self.send_json({'status':'verified-http','checks':['static','api','javascript','market-lifecycle','vault-ledger','position-transfer','pq-receipts','pq-vault-envelope','oracle-policy'],'visual':'pending'})
        if path=='/api/proofroom':
            ledger=ROOT/'public'/'ledger.json'; manifest=ROOT/'release-manifest.json'
            lj=json.loads(ledger.read_text()) if ledger.exists() else {'count':0}; mj=json.loads(manifest.read_text()) if manifest.exists() else {}
            return self.send_json({'marketTemplates':len(market_catalog.templates(normalized_live_assets())),'ledgerRows':lj.get('count',0),'releaseRoot':mj.get('rootCommitment'),'crypto':pq_crypto.public_metadata(),'automaticSettlement':True,'chainBackedTradeEndpoint':'/api/markets/:id/trade-chain'})
        if path=='/api/prestocks': return self.send_json(normalized_live_assets())
        if path=='/api/launch/routes': return self.send_json({'routes':[{'id':'sponsored','priority':1,'status':'discover'},{'id':'native','priority':2,'serviceFeeEth':0.005,'status':'active'},{'id':'clawpump','priority':3,'status':'optional-adapter'}]})
        return super().do_GET()
    def do_POST(self):
        try: payload=self.body()
        except Exception as e: return self.send_json({'error':'invalid_json','detail':str(e)},400)
        p=urllib.parse.urlparse(self.path).path
        try:
            if p=='/api/auth/challenge': return self.send_json(auth.challenge(payload.get('wallet')),201)
            if p=='/api/auth/verify': return self.send_json(auth.verify(payload.get('wallet'),payload.get('nonce'),payload.get('signature')),201)
            if p=='/api/auth/agent':
                owner=self.trader(payload=payload); return self.send_json(auth.issue_agent(owner,payload.get('agentId'),payload.get('scopes')),201)
            if p=='/api/prestocks/order':
                who=self.trader(payload=payload); mint=payload.get('mint'); side=payload.get('side','BUY').upper()
                if mint not in market_store.PRESTOCK_MINTS: raise ValueError('underlying_not_prestocks_eligible')
                if side=='BUY': return self.send_json(solana_finance.prestock_buy_order(mint,payload.get('usdcAmount'),who))
                return self.send_json(solana_finance.prestock_sell_order(mint,payload.get('tokenAmountAtomic'),who))
            if p=='/api/prestocks/execute':
                self.trader(payload=payload); return self.send_json(solana_finance.jupiter_execute(payload.get('signedTransaction'),payload.get('requestId')))
            if p=='/api/pay/solana-request':
                self.trader(payload=payload); return self.send_json(solana_finance.solana_pay_request(payload.get('recipient'),payload.get('amount'),payload.get('mint',USDC_MINT),payload.get('label','Stocklana'),payload.get('message','MAQUE payment'),payload.get('memo','')),201)
            if p=='/api/agent-vaults':
                owner=self.trader(payload=payload); v=agent_vault.create_agent_vault(payload.get('agentId'),owner,payload.get('name'))
                accounting_tokens.digest({'type':'AGENT_BUDGET_SET','agentId':v['agentId'],'amount':v['policy']['dailySpendLimitUSDC'],'owner':owner,'source':'agent-vault-provisioning'})
                return self.send_json(v,201)
            if p=='/api/accounting/digest':
                expected=os.getenv('STOCKLANA_ACCOUNTING_OPERATOR_TOKEN',''); supplied=self.headers.get('X-Stocklana-Accounting-Operator','')
                if not expected or not secrets.compare_digest(supplied,expected): return self.send_json({'error':'accounting_operator_unauthorized'},401)
                return self.send_json(accounting_tokens.digest(payload),201)
            if p=='/api/pay/handle': return self.send_json(payment_fabric.register_handle(self.trader(payload=payload),payload.get('handle')),201)
            if p=='/api/pay/request': return self.send_json(payment_fabric.make_payment_request(payload.get('payee'),payload.get('amount'),payload.get('asset','USDC'),payload.get('memo',''),payload.get('ttl',900)),201)
            if p=='/api/pay/device': return self.send_json(payment_fabric.register_device(self.trader(payload=payload),payload.get('deviceId'),payload.get('publicKey')),201)
            if p=='/api/pay/offline/accept': return self.send_json(payment_fabric.accept_offline_intent(payload.get('intent'),payload.get('signature')),201)
            if p=='/api/pay/send':
                sender=self.trader(payload=payload); recipient=payment_fabric.resolve_handle(payload.get('to','')) or payload.get('to')
                pain=iso20022.pain001(sender,recipient,payload.get('amount'),payload.get('asset','USDC'),payload.get('memo',''),'internal')
                result=finance_store.transfer(sender,recipient,payload.get('amount'),payload.get('asset','USDC'),payload.get('memo',''))
                if payload.get('asset','USDC')=='USDC': result['accounting']=accounting_tokens.digest({'type':'INTERNAL_TRANSFER','sender':sender,'recipient':recipient,'amount':payload.get('amount'),'eventId':(result.get('transfer') or {}).get('id')})
                result['iso20022']={'initiation':pain,'settlement':iso20022.pacs008(pain,(result.get('receipt') or {}).get('id')),'remittance':iso20022.remt001(pain)}
                return self.send_json(result)
            if p=='/api/pay/cashout': return self.send_json(payment_fabric.cashout_intent(self.trader(payload=payload),payload.get('amount'),payload.get('destinationType'),payload.get('destinationRef')),201)
            if p=='/api/card/policy': return self.send_json(card_rail.create_policy(self.trader(payload=payload),payload.get('amount'),payload.get('merchant'),payload.get('mcc'),payload.get('ttl',900)),201)
            if p=='/api/card/issue': return self.send_json(card_rail.issue_virtual(self.trader(payload=payload),payload.get('policyId')))
            if p=='/api/card/capture': return self.send_json(card_rail.capture(self.trader(payload=payload),payload.get('policyId'),payload.get('amount'),payload.get('providerReceipt')))
            if p=='/api/card/cancel': return self.send_json(card_rail.cancel(self.trader(payload=payload),payload.get('policyId')))
            if p=='/api/lending/fund': return self.send_json(lending.fund_pool(self.trader(payload=payload),payload.get('amount')))
            if p=='/api/lending/quote': return self.send_json(lending.quote(payload.get('collateral'),payload.get('borrow'),payload.get('aprBps',900),payload.get('days',30)))
            if p=='/api/lending/open': return self.send_json(lending.open_loan(self.trader(payload=payload),payload.get('collateral'),payload.get('borrow'),payload.get('aprBps',900),payload.get('days',30)),201)
            if p=='/api/lending/repay': return self.send_json(lending.repay(self.trader(payload=payload),payload.get('loanId')))
            if p=='/api/simulate/market': return self.send_json(simulations.parimutuel_payoff(payload.get('yesPool',0),payload.get('noPool',0),payload.get('side','YES'),payload.get('stake',10),payload.get('feeBps',100)))
            if p=='/api/simulate/stress': return self.send_json(simulations.stress_market(payload.get('yesPool',0),payload.get('noPool',0),payload.get('orders',[])))
            if p=='/api/growth/referral': return self.send_json(growth.create_referral(self.trader(payload=payload),payload.get('kind','market'),payload.get('target'),payload.get('shareBps',1000)),201)
            if p=='/api/growth/event': return self.send_json(growth.record(payload.get('code'),payload.get('event'),payload.get('revenueUSDC',0)))
            if p=='/api/equity/recurring': return self.send_json(equity_os.recurring_plan(self.trader(payload=payload),payload.get('symbol'),payload.get('usdcAmount'),payload.get('cadence','WEEKLY'),payload.get('day')),201)
            if p=='/api/equity/recurring/next': return self.send_json({'actions':equity_os.next_recurring_actions(self.trader(payload=payload))})
            if p=='/api/equity/basket': return self.send_json(equity_os.create_basket(self.trader(payload=payload),payload.get('name'),payload.get('members') or [],payload.get('weights'),payload.get('rebalance','MONTHLY')),201)
            if p=='/api/equity/basket/orders': return self.send_json(equity_os.basket_orders(payload.get('basketId'),payload.get('totalUSDC')))
            if p=='/api/equity/robo': return self.send_json(equity_os.create_robo(self.trader(payload=payload),payload.get('risk','BALANCED'),payload.get('monthlyUSDC',250)),201)
            if p=='/api/equity/social': return self.send_json(equity_os.social_signal(self.trader(payload=payload),payload.get('symbol'),payload.get('thesis',''),payload.get('visibility','FRIENDS')),201)
            if p=='/api/equity/corporate-action': return self.send_json(equity_os.record_corporate_action(payload.get('symbol'),payload.get('type'),payload.get('effectiveAt'),payload.get('payload') or {},payload.get('source','ISSUER_OR_PROVIDER')),201)
            if p=='/api/kamino/deposit': self.trader(payload=payload); return self.send_json(kamino.build_deposit(payload.get('wallet'),payload.get('market'),payload.get('reserve'),payload.get('amount')))
            if p=='/api/kamino/borrow': self.trader(payload=payload); return self.send_json(kamino.build_borrow(payload.get('wallet'),payload.get('market'),payload.get('reserve'),payload.get('amount')))
            if p=='/api/clawpump/pairs': return self.send_json(clawpump.pump_pairs())
            if p=='/api/clawpump/preflight': self.trader(payload=payload); return self.send_json(clawpump.self_funded_preflight(payload.get('launch') or payload))
            if p=='/api/clawpump/launch': self.trader(payload=payload); return self.send_json(clawpump.self_funded_launch(payload.get('launch') or payload,payload.get('txSignature'),payload.get('preflightToken')))
            if p=='/api/clawpump/robinhood': self.trader(payload=payload); return self.send_json(clawpump.robinhood_launch(payload.get('launch') or payload,payload.get('idempotencyKey')))
            if p=='/api/clawpump/uniswap': self.trader(payload=payload); return self.send_json(clawpump.uniswap_launch(payload.get('launch') or payload,payload.get('idempotencyKey')))
            if p=='/api/markets':
                creator=self.trader(payload=payload); return self.send_json(market_store.create_market({**payload,'creator':creator}),201)
            if p=='/api/vault/confirm-deposit':
                trader=self.trader(payload=payload); proof=self.verify_usdc_deposit(payload.get('signature'),payload.get('amount'),payload.get('wallet') or trader); out=finance_store.credit_once(trader,proof['verifiedAmount'],'USDC','solana-mainnet',payload.get('signature')); out['chainProof']=proof
                out['accounting']=accounting_tokens.digest({'type':'DEPOSIT_USDC','user':trader,'amount':proof['verifiedAmount'],'reference':payload.get('signature'),'eventId':f"solana-deposit:{payload.get('signature')}"})
                return self.send_json(out)
            if p=='/api/vault/credit':
                if os.getenv('STOCKLANA_DEV_CREDIT')!='1': return self.send_json({'error':'dev_credit_disabled'},403)
                trader=self.trader(payload=payload); out=finance_store.credit(trader,payload.get('amount'),payload.get('asset','USDC'),payload.get('source','dev-credit'),payload.get('reference'))
                if payload.get('asset','USDC')=='USDC': out['accounting']=accounting_tokens.digest({'type':'DEPOSIT_USDC','user':trader,'amount':payload.get('amount'),'reference':payload.get('reference'),'eventId':f"dev-credit:{payload.get('reference') or (out.get('receipt') or {}).get('id')}"})
                return self.send_json(out)
            if p=='/api/vault/withdraw':
                return self.send_json(finance_store.request_withdrawal(self.trader(payload=payload),payload.get('amount'),payload.get('destination'),payload.get('asset','USDC')),201)
            if p=='/api/vault/withdraw/confirm':
                wid=payload.get('withdrawalId'); w=finance_store.withdrawal(wid)
                if not w: raise ValueError('withdrawal_not_found')
                proof=self.verify_usdc_withdrawal(payload.get('signature'),w['amount'],w['destination'])
                out=finance_store.confirm_withdrawal(wid,proof)
                if w.get('asset','USDC')=='USDC': out['accounting']=accounting_tokens.digest({'type':'WITHDRAW_USDC','user':w['user'],'amount':w['amount'],'reference':payload.get('signature'),'eventId':f"solana-withdraw:{payload.get('signature')}"})
                return self.send_json(out)
            if p=='/api/vault/withdraw/cancel':
                return self.send_json(finance_store.cancel_withdrawal(self.trader(payload=payload),payload.get('withdrawalId')))
            if p=='/api/vault/transfer':
                sender=self.trader(payload=payload); out=finance_store.transfer(sender,payload.get('recipient'),payload.get('amount'),payload.get('asset','USDC'),payload.get('memo',''))
                if payload.get('asset','USDC')=='USDC': out['accounting']=accounting_tokens.digest({'type':'INTERNAL_TRANSFER','sender':sender,'recipient':payload.get('recipient'),'amount':payload.get('amount'),'eventId':(out.get('transfer') or {}).get('id')})
                return self.send_json(out)
            if p=='/api/vault/move': return self.send_json(finance_store.move_subaccount(self.trader(payload=payload),payload.get('amount'),payload.get('source','CASH'),payload.get('destination','TRADING'),payload.get('asset','USDC')))
            if p=='/api/funding/onramp':
                provider=payload.get('provider','stripe'); user=self.trader(payload=payload); amount=float(payload.get('amount',100))
                base=os.getenv('STRIPE_ONRAMP_URL') if provider=='stripe' else os.getenv('COINBASE_ONRAMP_URL')
                if not base: return self.send_json({'provider':provider,'ready':False,'reason':'provider_url_not_configured','network':'solana','asset':'USDC','amount':amount},200)
                sep='&' if '?' in base else '?'; url=f"{base}{sep}destination_network=solana&destination_currency=usdc&source_amount={urllib.parse.quote(str(amount))}&client_reference_id={urllib.parse.quote(user)}"
                return self.send_json({'provider':provider,'ready':True,'url':url,'network':'solana','asset':'USDC','amount':amount})
            if p=='/api/keeper/run':
                expected=os.getenv('STOCKLANA_KEEPER_TOKEN','')
                supplied=self.headers.get('X-Stocklana-Keeper','')
                if expected and not secrets.compare_digest(supplied,expected): return self.send_json({'error':'keeper_unauthorized'},401)
                if not expected and os.getenv('STOCKLANA_DEV_KEEPER')!='1': return self.send_json({'error':'keeper_not_configured'},503)
                return self.send_json(keeper.run_once(live_only=True))
            parts=p.strip('/').split('/')
            if len(parts)==4 and parts[0]=='api' and parts[1]=='markets':
                mid,action=parts[2],parts[3]
                if action=='quote': return self.send_json(market_store.quote_market(mid,payload.get('side'),payload.get('shares')))
                if action=='trade-chain':
                    trader=self.trader(payload=payload)
                    q=market_store.quote_market(mid,payload.get('side'),payload.get('shares'))
                    proof=self.verify_usdc_deposit(payload.get('signature'),q['total'],payload.get('wallet') or trader)
                    credited=finance_store.credit_once(trader,proof['verifiedAmount'],'USDC','solana-market-payment',payload.get('signature'))
                    accounting_tokens.digest({'type':'DEPOSIT_USDC','user':trader,'amount':proof['verifiedAmount'],'reference':payload.get('signature'),'eventId':f"solana-deposit:{payload.get('signature')}"})
                    result=market_execution.vault_trade(trader,mid,payload.get('side'),payload.get('shares'),'solana-mainnet',payload.get('signature'),proof.get('slot'))
                    result['paymentMode']='solana-mainnet'; result['chainProof']=proof; result['vaultCreditReceipt']=credited.get('receipt')
                    return self.send_json(result)
                if action=='trade':
                    trader=self.trader(payload=payload); mode=payload.get('paymentMode','vault')
                    q=market_store.quote_market(mid,payload.get('side'),payload.get('shares'))
                    if mode!='vault': raise ValueError('unsupported_payment_mode')
                    result=market_execution.vault_trade(trader,mid,payload.get('side'),payload.get('shares'),'vault')
                    result['paymentMode']=mode; return self.send_json(result)
                if action=='transfer-position':
                    sender=self.trader(payload=payload); return self.send_json(market_execution.transfer_position(sender,payload.get('recipient'),mid,payload.get('side'),payload.get('shares')))
                if action=='resolve':
                    expected=os.getenv('STOCKLANA_KEEPER_TOKEN',''); supplied=self.headers.get('X-Stocklana-Keeper','')
                    if not (expected and secrets.compare_digest(supplied,expected)) and os.getenv('STOCKLANA_DEV_KEEPER')!='1': return self.send_json({'error':'manual_resolution_disabled_use_keeper'},403)
                    return self.send_json(market_store.resolve(mid,payload))
                if action=='redeem':
                    trader=self.trader(payload=payload); return self.send_json(market_execution.redeem(trader,mid))
            if p=='/api/command': return self.send_json({'ok':True,'accepted':True,'command':payload})
            return self.send_json({'error':'not_found'},404)
        except KeyError as e: return self.send_json({'error':str(e)},404)
        except ValueError as e: return self.send_json({'error':str(e)},400)
        except Exception as e: return self.send_json({'error':'server_error','detail':str(e)},500)
    def send_json(self,obj,status=200):
        body=json.dumps(obj).encode(); self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self,fmt,*args): pass

if __name__=='__main__':
    ensure_seed_markets()
    p=argparse.ArgumentParser(); p.add_argument('--host',default='127.0.0.1'); p.add_argument('--port',type=int,default=5173); a=p.parse_args(); os.chdir(ROOT); print(f'Stocklana http://{a.host}:{a.port}'); ThreadingHTTPServer((a.host,a.port),Handler).serve_forever()
