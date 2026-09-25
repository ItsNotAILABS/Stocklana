#!/usr/bin/env python3
import base64, importlib.util, json, pathlib, random, sys, time
from collections import Counter
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
ROOT=pathlib.Path(__file__).resolve().parents[1];SRC=ROOT/'src';sys.path.insert(0,str(SRC))
def load(n,f):
 s=importlib.util.spec_from_file_location(n,SRC/f);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
agent=load('wr_agent','agent_vault.py');pay=load('wr_pay','payment_fabric.py');fin=load('wr_fin','finance-store.py');mkt=load('wr_mkt','market-store.py');mex=load('wr_mex','market_execution.py');cat=load('wr_cat','market-catalog.py');iso=load('wr_iso','iso20022_bridge.py');sim=load('wr_sim','simulations.py');growth=load('wr_growth','growth.py');sol=load('wr_sol','solana_finance.py');card=load('wr_card','card_rail.py');lend=load('wr_lend','lending.py')
assets=json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text(encoding='utf-8'));vaults=agent.list_agent_vaults()
if len(vaults)<100:vaults=agent.seed_agent_vaults(100)
vaults=sorted(vaults,key=lambda x:x['agentId'])[:100]
roles=['active_trader','holder','social_payer','agent_operator','market_researcher','risk_averse','merchant','yield_seeker','creator','newcomer']
personas=[{'agentId':v['agentId'],'user':f'regression-{i:03d}','role':roles[i%10],'risk':['low','medium','high'][i%3],'symbol':assets[i%8]['symbol']} for i,v in enumerate(vaults,1)]
(ROOT/'data'/'agent-personas.json').write_text(json.dumps(personas,indent=2))
run='week100r-'+str(int(time.time()));C=Counter();fail=[];sessions=0
# give each regression identity explicit, labeled test capital. This is local regression capital, not a chain deposit.
for p in personas:
 try: fin.credit(p['user'],80,'USDC','week100-regression-capital',run)
 except Exception as e: fail.append(['seed',p['agentId'],str(e)])
# 8 isolated markets
by_symbol={a['symbol']:a for a in assets};tpls=cat.templates(assets);sel=[];seen=set()
for t in tpls:
 if t['symbol'] in by_symbol and t['symbol'] not in seen: sel.append(t);seen.add(t['symbol'])
 if len(sel)==8:break
markets=[]
for j,t in enumerate(sel):
 mid=f'{run}-m{j}';markets.append(mkt.create_market({**t,'id':mid,'resolveAt':'2026-10-01T00:00:00Z','creator':run,'feeBps':100}))
# explicit liquidity pool for credit tests; only 5 yield personas will borrow.
provider=run+'-lp';fin.credit(provider,1000,'USDC','week100-regression-liquidity',run);lend.fund_pool(provider,500)
devices={}
for day in range(1,8):
 for i,p in enumerate(personas):
  try:
   u=p['user'];role=p['role'];m=markets[i%8]
   if day==1:
    iso.pain001(u,'stocklana:merchant',1,'USDC','onboarding','internal');sim.basket_scenario([1,-1,2]);C['onboarding+iso']+=1
   elif day==2:
    # Everyone quotes the real market engine; active/creator/newcomer segments actually trade through shared escrow.
    mkt.quote_market(m['id'],'YES' if i%2==0 else 'NO',5);C['market_quotes']+=1
    if role in {'active_trader','creator','newcomer'}:
     mex.vault_trade(u,m['id'],'YES' if i%2==0 else 'NO',5,'vault');C['market_trades']+=1
    jp=sol.prestock_buy_order(m['underlyingMint'],5,'11111111111111111111111111111111');C['jupiter_order_ready' if jp.get('ready') else 'jupiter_external_auth_gate']+=1
   elif day==3:
    nxt=personas[(i+1)%100]['user'];
    if role in {'social_payer','merchant'}:
     fin.transfer(u,nxt,1,'USDC','week100 friend payment');C['internal_payments']+=1
     sk=Ed25519PrivateKey.generate();raw=sk.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw);did=f'{run}-d{i}';pay.register_device(u,did,base64.b64encode(raw).decode());now=int(time.time());intent={'v':1,'type':'MAQUE_OFFLINE_PAY','payer':u,'payee':nxt,'asset':'USDC','amount':1,'nonce':f'{run}-n{i}','issuedAt':now,'expiresAt':now+600,'deviceId':did};sig=base64.b64encode(sk.sign(pay.canonical(intent))).decode();pay.accept_offline_intent(intent,sig)
     try:pay.accept_offline_intent(intent,sig);raise AssertionError('replay accepted')
     except ValueError as e:assert str(e)=='replay_detected'
     C['offline_payments']+=1;C['replay_rejections']+=1
    else: pay.make_payment_request(u,2,'USDC','week100 request');C['payment_requests']+=1
   elif day==4:
    sim.stress_market(60,40,[{'side':'YES','stake':3},{'side':'NO','stake':2}]);C['stress_simulations']+=1
    if role=='active_trader':
     pos=mkt.position(m['id'],u);side='YES' if pos.get('yes',0)>=1 else 'NO';amount=pos.get('yes' if side=='YES' else 'no',0)
     if amount>=1:mex.transfer_position(u,personas[(i+1)%100]['user'],m['id'],side,1);C['position_transfers']+=1
   elif day==5:
    if role in {'merchant','power_user'}: pass
    if role in {'merchant','agent_operator'}:
     pol=card.create_policy(u,2,'WEEK100','5999',900);card.cancel(u,pol['id']);C['card_reserve_cancel']+=1
    else: fin.account(u);C['vault_checks']+=1
   elif day==6:
    ref=growth.create_referral(u,'market',m['id'],1000);growth.record(ref['code'],'click',0);C['growth_attribution']+=1
    if role=='yield_seeker':
     loan=lend.open_loan(u,10,4,900,30);C['pool_funded_loans']+=1
   else:
    s=mex.solvency(m['id']);assert s['solvent'] and s['houseDirectionalExposure']==0.0;C['solvency_checks']+=1
   sessions+=1
  except Exception as e:fail.append([f'day{day}',p['agentId'],str(e)])
solv={m['id']:mex.solvency(m['id']) for m in markets}
proof={'runId':run,'agents':100,'days':7,'sessionsAttempted':700,'sessionsSucceeded':sessions,'personalities':len(personas),'roles':dict(Counter(p['role'] for p in personas)),'actions':dict(C),'failures':fail,'allMarketsSolvent':all(x['solvent'] for x in solv.values()),'houseDirectionalExposure':max(x['houseDirectionalExposure'] for x in solv.values()),'externalNetworkNote':'Jupiter order construction is counted separately from external chain execution; no fill is claimed without provider response + wallet signature.','status':'PASS' if sessions==700 and not fail and all(x['solvent'] for x in solv.values()) else 'FAIL'}
(ROOT/'WEEK-100-PROOF.json').write_text(json.dumps(proof,indent=2,sort_keys=True));lines=['# Stocklana 100-Agent / Seven-Day Regression','',f'**Result: {proof["status"]}**',f'- Agents: 100',f'- Personalities: {proof["personalities"]}',f'- Sessions: {sessions}/700',f'- All exercised markets solvent: {proof["allMarketsSolvent"]}',f'- House directional exposure: {proof["houseDirectionalExposure"]}','','## Actions']+[f'- {k}: {v}' for k,v in sorted(C.items())]+['','## Failures','```json',json.dumps(fail,indent=2),'```','',proof['externalNetworkNote']];(ROOT/'WEEK-100-REPORT.md').write_text('\n'.join(lines)+'\n');print(json.dumps(proof,indent=2)[:6000])
