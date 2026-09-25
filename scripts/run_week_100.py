#!/usr/bin/env python3
import base64, importlib.util, json, os, pathlib, random, sys, time
from collections import Counter, defaultdict
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
ROOT=pathlib.Path(__file__).resolve().parents[1]; SRC=ROOT/'src'; sys.path.insert(0,str(SRC))
def load(name,file):
 s=importlib.util.spec_from_file_location(name,SRC/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
agent=load('week_agent','agent_vault.py'); pay=load('week_pay','payment_fabric.py'); finance=load('week_fin','finance-store.py')
market=load('week_market','market-store.py'); mex=load('week_mex','market_execution.py'); catalog=load('week_catalog','market-catalog.py')
iso=load('week_iso','iso20022_bridge.py'); card=load('week_card','card_rail.py'); lending=load('week_lend','lending.py')
sim=load('week_sim','simulations.py'); growth=load('week_growth','growth.py'); pq=load('week_pq','pq_crypto.py'); sol=load('week_sol','solana_finance.py')
assets=json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text(encoding='utf-8'))
random.seed(260922)
roles=['active_trader','long_term_holder','social_sender','agent_operator','market_creator','risk_averse','power_user','merchant_user','yield_seeker','newcomer']
risk=['conservative','balanced','aggressive']
goals=['discover private markets','trade simple games','pay friends','fund agents','manage collateral','compare outcomes','build a basket','earn referral fees','test offline pay','automate finance']
personas=[]
for i in range(100):
 personas.append({'id':f'stocklana-agent-{i+1:03d}','user':f'week100-user-{i+1:03d}','name':f'Agent {i+1:03d}','role':roles[i%len(roles)],'risk':risk[i%len(risk)],'goal':goals[i%len(goals)],'weeklyBudgetUSDC':150+(i%7)*25,'preferredSymbol':assets[i%len(assets)]['symbol']})
(ROOT/'data'/'agent-personas.json').write_text(json.dumps(personas,indent=2))
# Use a dedicated run namespace while exercising the same production modules.
run_id='week100_'+str(int(time.time()))
results={'runId':run_id,'agents':100,'days':7,'sessionsAttempted':700,'sessionsSucceeded':0,'actions':Counter(),'failures':[],'external':Counter(),'solvency':{},'personas':personas}
# provision vaults, handles, device keys, balances
keys={}
for p in personas:
 try:
  v=agent.create_agent_vault(p['id'],p['user'],p['name'])
  proof_obj={'event':'agent_vault_created','vaultId':v['vaultId'],'agentId':p['id'],'owner':p['user'],'at':v['createdAt']}
  assert pq.hybrid_verify(proof_obj,v['provisioningProof'])
  results['actions']['agent_vault_verified']+=1
  try: pay.register_handle(p['user'],p['id'])
  except ValueError as e:
   if str(e)!='handle_taken': raise
  priv=Ed25519PrivateKey.generate(); pub=priv.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw)
  did=f'{run_id}-{p["id"]}'
  pay.register_device(p['user'],did,base64.b64encode(pub).decode()); keys[p['user']]=(priv,did)
  finance.credit(p['user'],p['weeklyBudgetUSDC'],'USDC','week100-regression-capital',run_id)
 except Exception as e: results['failures'].append({'stage':'provision','agent':p['id'],'error':str(e)})
# lending pool funded from explicit regression-liquidity provider
provider=run_id+'-liquidity-provider'; finance.credit(provider,10000,'USDC','week100-regression-liquidity',run_id); lending.fund_pool(provider,5000)
# Create 8 dedicated markets spanning assets/rules.
tpls=catalog.templates(assets); selected=[]; seen=set()
for t in tpls:
 if t['symbol'] in {a['symbol'] for a in assets} and t['symbol'] not in seen:
  selected.append(t);seen.add(t['symbol'])
 if len(selected)==8: break
markets=[]
for i,t in enumerate(selected):
 m=market.create_market({'id':f'{run_id}-m{i+1}','underlyingMint':t['underlyingMint'],'symbol':t['symbol'],'question':t['question'],'resolveAt':'2026-09-30T00:00:00Z','rule':t['rule'],'feeBps':100,'creator':'week100-regression'})
 markets.append(m)
# Seven-day behavioral run. Every agent gets one session/day; actions are real module calls.
for day in range(1,8):
 for i,p in enumerate(personas):
  user=p['user']; ok=True
  try:
   if day==1:
    pay.make_payment_request('@'+p['id'],5+(i%5),'USDC',f'week onboarding {i}')
    pm=iso.pain001(user,'stocklana:merchant',3+(i%3),'USDC','week onboarding','internal'); iso.pacs008(pm,run_id+'-d1')
    results['actions']['payment_request']+=1;results['actions']['iso20022']+=1
   elif day==2:
    m=markets[i%len(markets)]; side='YES' if i%2==0 else 'NO'; mex.vault_trade(user,m['id'],side,10+(i%4),'vault')
    results['actions']['market_trade']+=1
    # Jupiter plan targets actual PreStock mint. Without key this is correctly a non-submitted external gate.
    jp=sol.prestock_buy_order(m['underlyingMint'],5,'11111111111111111111111111111111')
    results['external']['jupiter_ready' if jp.get('ready') else 'jupiter_external_auth_required']+=1
   elif day==3:
    nxt=personas[(i+1)%100]['user']; finance.transfer(user,nxt,1,'USDC',f'week100 friend pay d3 {i}')
    priv,did=keys[user]; now=int(time.time()); intent={'v':1,'type':'MAQUE_OFFLINE_PAY','payer':user,'payee':nxt,'asset':'USDC','amount':1.0,'nonce':f'{run_id}-nonce-{i}','issuedAt':now,'expiresAt':now+3600,'deviceId':did}
    sig=base64.b64encode(priv.sign(pay.canonical(intent))).decode();pay.accept_offline_intent(intent,sig)
    try:pay.accept_offline_intent(intent,sig);raise AssertionError('replay accepted')
    except ValueError as e: assert str(e)=='replay_detected'
    results['actions']['internal_payment']+=1;results['actions']['offline_payment']+=1;results['actions']['replay_rejected']+=1
   elif day==4:
    m=markets[i%len(markets)]; side='YES' if i%2==0 else 'NO'; nxt=personas[(i+1)%100]['user'];mex.transfer_position(user,nxt,m['id'],side,1)
    results['actions']['position_transfer']+=1
    sim.parimutuel_payoff(100,80,side,10);results['actions']['payoff_simulation']+=1
   elif day==5:
    pol=card.create_policy(user,3+(i%4),merchant='WEEK100',mcc='5999',ttl=3600)
    try: card.capture(user,pol['id'],pol['maxAmountUSDC']+1);raise AssertionError('overcapture accepted')
    except ValueError as e: assert str(e)=='amount_exceeds_policy'
    if i%2==0: card.capture(user,pol['id'],2,provider_receipt=f'{run_id}-provider-test-{i}')
    else: card.cancel(user,pol['id'])
    results['actions']['single_use_card_policy']+=1;results['actions']['card_overcapture_rejected']+=1
   elif day==6:
    code=growth.create_referral(user,'market',markets[i%len(markets)]['id'],1000);growth.record(code['code'],'click',0)
    sim.stress_market(50,50,[{'side':'YES','stake':5},{'side':'NO','stake':7}]);results['actions']['growth_event']+=1;results['actions']['liquidity_stress']+=1
    if i<20:
     loan=lending.open_loan(user,20,5,900,30);results['actions']['pool_funded_loan']+=1
   elif day==7:
    # Account/reconciliation day plus live solvency inspection.
    finance.account(user); results['actions']['vault_reconciliation']+=1
    s=mex.solvency(markets[i%len(markets)]['id']); assert s['solvent'] and s['houseDirectionalExposure']==0.0
    results['actions']['solvency_check']+=1
  except Exception as e:
   ok=False;results['failures'].append({'stage':f'day{day}','agent':p['id'],'error':str(e)})
  if ok: results['sessionsSucceeded']+=1
# final market solvency and conservation snapshot
for m in markets: results['solvency'][m['id']]=mex.solvency(m['id'])
results['actions']=dict(results['actions']);results['external']=dict(results['external']);results['successRate']=results['sessionsSucceeded']/700
results['allMarketsSolvent']=all(x['solvent'] and x['houseDirectionalExposure']==0.0 for x in results['solvency'].values())
results['financeConservationSnapshot']=finance.conservation()
results['passed']=results['sessionsSucceeded']==700 and not results['failures'] and results['allMarketsSolvent'] and results['actions'].get('agent_vault_verified')==100
out=ROOT/'WEEK-100-PROOF.json';out.write_text(json.dumps(results,indent=2,sort_keys=True,default=str))
md=['# Stocklana 100-Agent / 7-Day Regression','',f'- Run: `{run_id}`',f'- Sessions: **{results["sessionsSucceeded"]}/700**',f'- Passed: **{results["passed"]}**',f'- All exercised markets solvent: **{results["allMarketsSolvent"]}**','', '## Executed actions']
for k,v in sorted(results['actions'].items()): md.append(f'- {k}: {v}')
md += ['', '## External-network boundary']
for k,v in sorted(results['external'].items()): md.append(f'- {k}: {v}')
md += ['', 'External-network order planning is not counted as a chain fill unless the configured provider returns an execution result/signature.','', '## Failures', json.dumps(results['failures'],indent=2)]
(ROOT/'WEEK-100-REPORT.md').write_text('\n'.join(md)+'\n')
print(json.dumps({'passed':results['passed'],'sessions':results['sessionsSucceeded'],'failures':len(results['failures']),'actions':results['actions'],'external':results['external'],'marketsSolvent':results['allMarketsSolvent']},indent=2))
