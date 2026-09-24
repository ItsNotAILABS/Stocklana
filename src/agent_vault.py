import json, time, uuid, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import pq_crypto
DB=ROOT/'data'/'agent-vaults.json'

def _load():
    if not DB.exists(): return {'vaults':{},'events':[]}
    try: return json.loads(DB.read_text())
    except: return {'vaults':{},'events':[]}

def _save(d):
    t=DB.with_suffix('.tmp'); t.write_text(json.dumps(d,indent=2,sort_keys=True)); t.replace(DB)


def _migrate(v):
    v.setdefault('financialTokens',{'budget':'SL-AGENT','cash':'SL-CASH','collateral':'SL-COLL','positions':'SL-POS','basket':'SL-BASKET','versionProfiles':['V2_TOKEN_2022']})
    p=v.setdefault('policy',{})
    p.setdefault('dailySpendLimitUSDC',1000.0); p.setdefault('singleSpendLimitUSDC',250.0); p.setdefault('humanApprovalAboveUSDC',250.0)
    p.setdefault('allowExternalWithdrawals',False); p.setdefault('allowMarketTrading',True); p.setdefault('allowedAssets',['USDC','SOL'])
    p.setdefault('allowExternalCommerce',False); p.setdefault('allowedMerchants',[]); p.setdefault('allowSubscriptions',False)
    return v

def create_agent_vault(agent_id, owner, name=None):
    if not agent_id or not owner: raise ValueError('agent_and_owner_required')
    d=_load()
    if agent_id in d['vaults']:
        v=_migrate(d['vaults'][agent_id])
        if v.get('owner')!=owner: raise ValueError('agent_id_taken')
        d['vaults'][agent_id]=v; _save(d); return v
    now=int(time.time()*1000)
    vault={
      'vaultId':'av_'+uuid.uuid4().hex[:20], 'agentId':agent_id, 'owner':owner,
      'name':name or agent_id, 'createdAt':now, 'status':'ACTIVE',
      'accounts':{'CASH':{'USDC':0.0},'TRADING':{'USDC':0.0},'RESERVE':{'USDC':0.0},'FEES':{'USDC':0.0}},
      'connectors':{
        'solana':{'enabled':True,'mode':'transaction-builder'},
        'evm':{'enabled':True,'mode':'adapter'},
        'icp':{'enabled':True,'mode':'adapter'},
        'bitcoin':{'enabled':True,'mode':'watch-only'},
        'cosmos':{'enabled':True,'mode':'adapter'}},
      'policy':{'dailySpendLimitUSDC':1000.0,'singleSpendLimitUSDC':250.0,'humanApprovalAboveUSDC':250.0,'allowExternalWithdrawals':False,'allowMarketTrading':True,'allowedAssets':['USDC','SOL'],'allowExternalCommerce':False,'allowedMerchants':[],'allowSubscriptions':False},
      'permissions':{'readBalances':True,'createQuotes':True,'tradeWithinPolicy':True,'sendInternal':True,'withdrawExternal':False,'changePolicy':False},
      'reconciliation':{'enabled':True,'lastRun':None,'status':'PENDING'},
      'sentinel':{'enabled':True,'replayProtection':True,'velocityChecks':True,'anomalyGate':True,'lastAlert':None},
      'billing':{'feeAccount':'FEES','accruedUSDC':0.0},
      'monetization':{'creatorFeesUSDC':0.0,'marketFeesUSDC':0.0,'rewardsUSDC':0.0},
      'positions':{}, 'receipts':[],
      'financialTokens':{'budget':'SL-AGENT','cash':'SL-CASH','collateral':'SL-COLL','positions':'SL-POS','basket':'SL-BASKET','versionProfiles':['V2_TOKEN_2022']},
      'crypto':{'suite':pq_crypto.public_metadata()['suite'],'vaultEnvelope':'ML-KEM-768+X25519/AES-256-GCM','receiptSignature':'ML-DSA-65+Ed25519'}
    }
    proof={'event':'agent_vault_created','vaultId':vault['vaultId'],'agentId':agent_id,'owner':owner,'at':now}
    vault['provisioningProof']=pq_crypto.hybrid_sign(proof)
    d['vaults'][agent_id]=vault; d['events'].append(proof); _save(d); return vault

def get_agent_vault(agent_id):
    v=_load()['vaults'].get(agent_id); return _migrate(v) if v else None

def list_agent_vaults(): return [_migrate(v) for v in _load()['vaults'].values()]

def seed_agent_vaults(count=100, owner='stocklana-system'):
    return [create_agent_vault(f'stocklana-agent-{i:03d}',owner,f'Stocklana Agent {i:03d}') for i in range(1,int(count)+1)]


def _merchant(host):
    return str(host or '').lower().strip().split(':',1)[0].lstrip('www.')

def update_commerce_policy(agent_id,owner,daily_limit=None,single_limit=None,approval_above=None,allowed_merchants=None,allow_subscriptions=False,enabled=True):
    d=_load();v=d['vaults'].get(agent_id)
    if not v or v.get('owner')!=owner: raise ValueError('agent_vault_not_found')
    v=_migrate(v);p=v['policy']
    if daily_limit is not None:p['dailySpendLimitUSDC']=max(0.0,float(daily_limit))
    if single_limit is not None:p['singleSpendLimitUSDC']=max(0.0,float(single_limit))
    if approval_above is not None:p['humanApprovalAboveUSDC']=max(0.0,float(approval_above))
    if p['singleSpendLimitUSDC']>p['dailySpendLimitUSDC']: raise ValueError('single_limit_exceeds_daily_limit')
    if p['humanApprovalAboveUSDC']>p['singleSpendLimitUSDC']: p['humanApprovalAboveUSDC']=p['singleSpendLimitUSDC']
    p['allowExternalCommerce']=bool(enabled);p['allowSubscriptions']=bool(allow_subscriptions)
    if allowed_merchants is not None:
        vals=allowed_merchants if isinstance(allowed_merchants,list) else str(allowed_merchants).split(',')
        p['allowedMerchants']=sorted({h for h in (_merchant(x) for x in vals) if h})
    event={'type':'AGENT_COMMERCE_POLICY','agentId':agent_id,'owner':owner,'policy':{k:p[k] for k in ('dailySpendLimitUSDC','singleSpendLimitUSDC','humanApprovalAboveUSDC','allowExternalCommerce','allowedMerchants','allowSubscriptions')},'at':int(time.time())}
    d['vaults'][agent_id]=v;d.setdefault('events',[]).append(event);_save(d);return v

def daily_commerce_spend(agent_id,now=None):
    now=int(now or time.time()); start=now-86400; total=0.0
    for e in _load().get('events',[]):
        if e.get('type')=='AGENT_COMMERCE_SPEND' and e.get('agentId')==agent_id and int(e.get('at',0))>=start:
            total+=float(e.get('amountUSDC',0))
    return round(total,6)

def authorize_commerce(agent_id,owner,merchant_host,amount,subscription=False,human_present=False):
    v=get_agent_vault(agent_id)
    if not v or v.get('owner')!=owner: raise ValueError('agent_vault_not_found')
    if v.get('status')!='ACTIVE': raise ValueError('agent_vault_not_active')
    p=v['policy']; amount=float(amount);host=_merchant(merchant_host)
    if amount<=0: raise ValueError('invalid_amount')
    if not p.get('allowExternalCommerce'): raise ValueError('agent_external_commerce_disabled')
    allowed=[_merchant(x) for x in p.get('allowedMerchants',[])]
    if not allowed or ('*' not in allowed and host not in allowed): raise ValueError('merchant_not_allowed')
    if subscription and not p.get('allowSubscriptions',False): raise ValueError('agent_subscriptions_blocked')
    if amount>float(p.get('singleSpendLimitUSDC',0))+1e-9: raise ValueError('agent_single_spend_limit_exceeded')
    spent=daily_commerce_spend(agent_id)
    if spent+amount>float(p.get('dailySpendLimitUSDC',0))+1e-9: raise ValueError('agent_daily_spend_limit_exceeded')
    needs=amount>float(p.get('humanApprovalAboveUSDC',0))+1e-9
    return {'authorized':not needs or bool(human_present),'requiresHumanApproval':needs and not human_present,'humanPresent':bool(human_present),'agentId':agent_id,'merchantHost':host,'amountUSDC':amount,'dailySpentBeforeUSDC':spent,'dailyLimitUSDC':p.get('dailySpendLimitUSDC'),'singleLimitUSDC':p.get('singleSpendLimitUSDC'),'approvalAboveUSDC':p.get('humanApprovalAboveUSDC')}

def record_commerce(agent_id,owner,intent_id,merchant_host,amount):
    authz=authorize_commerce(agent_id,owner,merchant_host,amount,False,True)
    d=_load();e={'type':'AGENT_COMMERCE_SPEND','agentId':agent_id,'owner':owner,'intentId':intent_id,'merchantHost':_merchant(merchant_host),'amountUSDC':float(amount),'at':int(time.time())}
    d.setdefault('events',[]).append(e);_save(d);return {**e,'authorization':authz}
