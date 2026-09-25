#!/usr/bin/env python3
import argparse,base64,importlib.util,json,pathlib,sys,time
from collections import Counter
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
ROOT=pathlib.Path(__file__).resolve().parents[1];SRC=ROOT/'src';sys.path.insert(0,str(SRC));STATE=ROOT/'data'/'week100-state.json'
def load(n,f):
 s=importlib.util.spec_from_file_location(n,SRC/f);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
agent=load('w_agent','agent_vault.py');pay=load('w_pay','payment_fabric.py');fin=load('w_fin','finance-store.py');mkt=load('w_mkt','market-store.py');mex=load('w_mex','market_execution.py');cat=load('w_cat','market-catalog.py');iso=load('w_iso','iso20022_bridge.py');sim=load('w_sim','simulations.py');growth=load('w_growth','growth.py');sol=load('w_sol','solana_finance.py');card=load('w_card','card_rail.py');lend=load('w_lend','lending.py')
assets=json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text(encoding='utf-8'))
roles=['active_trader','holder','social_payer','agent_operator','market_researcher','risk_averse','merchant','yield_seeker','creator','newcomer']
def save(st): STATE.write_text(json.dumps(st,indent=2,sort_keys=True))
def init():
 run='week100-'+str(int(time.time())); vs=sorted(agent.list_agent_vaults(),key=lambda x:x['agentId'])[:100]
 if len(vs)<100:raise SystemExit('need 100 provisioned agent vaults')
 ps=[{'agentId':v['agentId'],'user':f'{run}-u{i:03d}','role':roles[(i-1)%10],'risk':['low','medium','high'][(i-1)%3],'symbol':assets[(i-1)%8]['symbol']} for i,v in enumerate(vs,1)]
 # Test-fixture capital is inserted directly so weekly workload measures product paths, not 100 setup receipts.
 db=fin._load()
 for p in ps:
  a=fin._acct(db,p['user']);a['balances']['USDC']=80.0;a['subaccounts']['CASH']['USDC']=80.0
 provider=run+'-lp';a=fin._acct(db,provider);a['balances']['USDC']=1000;a['subaccounts']['CASH']['USDC']=1000
 fin._save(db);lend.fund_pool(provider,500)
 tpls=cat.templates(assets);seen=set();sel=[]
 for t in tpls:
  if t['symbol'] in {a['symbol'] for a in assets} and t['symbol'] not in seen:sel.append(t);seen.add(t['symbol'])
  if len(sel)==8:break
 mids=[]
 for j,t in enumerate(sel):
  mid=f'{run}-m{j}';mkt.create_market({**t,'id':mid,'resolveAt':'2026-10-01T00:00:00Z','creator':run,'feeBps':100});mids.append(mid)
 st={'runId':run,'personas':ps,'markets':mids,'daysDone':[],'sessions':0,'actions':{},'failures':[],'createdAt':int(time.time())};save(st);(ROOT/'data'/'agent-personas.json').write_text(json.dumps(ps,indent=2));print(json.dumps({'initialized':True,'runId':run,'agents':100,'markets':8}))
def day(n):
 st=json.loads(STATE.read_text(encoding='utf-8'));
 if n in st['daysDone']:print(json.dumps({'day':n,'alreadyDone':True}));return
 C=Counter(st['actions']);fails=st['failures'];sessions=st['sessions'];ps=st['personas'];mids=st['markets']
 for i,p in enumerate(ps):
  try:
   u=p['user'];role=p['role'];mid=mids[i%8];m=[x for x in mkt.list_markets() if x['id']==mid][0]
   if n==1:
    iso.pain001(u,'stocklana:merchant',1,'USDC','onboarding','internal');sim.basket_scenario([1,-1,2]);C['onboarding_iso']+=1
   elif n==2:
    mkt.quote_market(mid,'YES' if i%2==0 else 'NO',5);C['market_quotes']+=1
    if role in {'active_trader','creator','newcomer'}:mex.vault_trade(u,mid,'YES' if i%2==0 else 'NO',5,'vault');C['market_trades']+=1
    jp=sol.prestock_buy_order(m['underlyingMint'],5,'11111111111111111111111111111111');C['jupiter_ready' if jp.get('ready') else 'jupiter_external_auth_gate']+=1
   elif n==3:
    nxt=ps[(i+1)%100]['user']
    if role in {'social_payer','merchant'}:
     fin.transfer(u,nxt,1,'USDC','week100 friend payment');C['internal_payments']+=1
     sk=Ed25519PrivateKey.generate();raw=sk.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw);did=f'{st["runId"]}-d{i}';pay.register_device(u,did,base64.b64encode(raw).decode());now=int(time.time());intent={'v':1,'type':'MAQUE_OFFLINE_PAY','payer':u,'payee':nxt,'asset':'USDC','amount':1,'nonce':f'{st["runId"]}-n{i}','issuedAt':now,'expiresAt':now+600,'deviceId':did};sig=base64.b64encode(sk.sign(pay.canonical(intent))).decode();pay.accept_offline_intent(intent,sig)
     try:pay.accept_offline_intent(intent,sig);raise AssertionError('replay accepted')
     except ValueError as e:assert str(e)=='replay_detected'
     C['offline_payments']+=1;C['offline_replay_rejections']+=1
    else:pay.make_payment_request(u,2,'USDC','week request');C['payment_requests']+=1
   elif n==4:
    sim.stress_market(60,40,[{'side':'YES','stake':3},{'side':'NO','stake':2}]);C['stress_simulations']+=1
    if role=='active_trader':
     pos=mkt.position(mid,u);side='YES' if pos.get('yes',0)>=1 else 'NO';amt=pos.get('yes' if side=='YES' else 'no',0)
     if amt>=1:mex.transfer_position(u,ps[(i+1)%100]['user'],mid,side,1);C['position_transfers']+=1
   elif n==5:
    if role in {'merchant','agent_operator'}:
     pol=card.create_policy(u,2,'WEEK100','5999',900);card.cancel(u,pol['id']);C['card_reserve_cancel']+=1
    else:fin.account(u);C['vault_checks']+=1
   elif n==6:
    ref=growth.create_referral(u,'market',mid,1000);growth.record(ref['code'],'click',0);C['growth_attribution']+=1
    if role=='yield_seeker':lend.open_loan(u,10,4,900,30);C['pool_funded_loans']+=1
   elif n==7:
    sv=mex.solvency(mid);assert sv['solvent'] and sv['houseDirectionalExposure']==0.0;C['solvency_checks']+=1
   sessions+=1
  except Exception as e:fails.append({'day':n,'agent':p['agentId'],'error':str(e)})
 st['sessions']=sessions;st['actions']=dict(C);st['failures']=fails;st['daysDone'].append(n);save(st);print(json.dumps({'day':n,'sessionsTotal':sessions,'newFailures':len([x for x in fails if x['day']==n]),'actions':dict(C)},indent=2))
def finish():
 st=json.loads(STATE.read_text(encoding='utf-8'));solv={mid:mex.solvency(mid) for mid in st['markets']};proof={**st,'agents':100,'days':7,'sessionsAttempted':700,'personalities':100,'roles':dict(Counter(p['role'] for p in st['personas'])),'allMarketsSolvent':all(x['solvent'] for x in solv.values()),'houseDirectionalExposure':max(x['houseDirectionalExposure'] for x in solv.values()),'solvency':solv,'externalNetworkRule':'No provider/network action counts as executed without provider response plus chain signature/receipt.','status':'PASS' if st['sessions']==700 and not st['failures'] and len(st['daysDone'])==7 and all(x['solvent'] for x in solv.values()) else 'FAIL'};(ROOT/'WEEK-100-PROOF.json').write_text(json.dumps(proof,indent=2,sort_keys=True));lines=['# Stocklana 100-Agent / Seven-Day Regression','',f'**Result: {proof["status"]}**',f'- Agents/personas: 100',f'- Sessions: {proof["sessions"]}/700',f'- Days completed: {proof["daysDone"]}',f'- All exercised markets solvent: {proof["allMarketsSolvent"]}',f'- House directional exposure: {proof["houseDirectionalExposure"]}','','## Executed workload']+[f'- {k}: {v}' for k,v in sorted(proof['actions'].items())]+['','## Failures','```json',json.dumps(proof['failures'],indent=2),'```','',proof['externalNetworkRule']];(ROOT/'WEEK-100-REPORT.md').write_text('\n'.join(lines)+'\n');print(json.dumps({'status':proof['status'],'sessions':proof['sessions'],'failures':len(proof['failures']),'actions':proof['actions'],'allMarketsSolvent':proof['allMarketsSolvent']},indent=2))
ap=argparse.ArgumentParser();ap.add_argument('cmd',choices=['init','day','finish']);ap.add_argument('--day',type=int);a=ap.parse_args();{'init':init,'day':lambda:day(a.day),'finish':finish}[a.cmd]()
