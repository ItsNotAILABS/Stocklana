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
    return v

def create_agent_vault(agent_id, owner, name=None):
    if not agent_id or not owner: raise ValueError('agent_and_owner_required')
    d=_load()
    if agent_id in d['vaults']:
        v=_migrate(d['vaults'][agent_id]); d['vaults'][agent_id]=v; _save(d); return v
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
      'policy':{'dailySpendLimitUSDC':1000.0,'singleSpendLimitUSDC':250.0,'humanApprovalAboveUSDC':250.0,'allowExternalWithdrawals':False,'allowMarketTrading':True,'allowedAssets':['USDC','SOL']},
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
