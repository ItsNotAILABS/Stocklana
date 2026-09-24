import importlib.util, pathlib, sys, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))

def load(name,file):
    sp=importlib.util.spec_from_file_location(name,ROOT/'src'/file); m=importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m
market_store=load('mstore_keeper','market-store.py')
finance_store=load('fstore_keeper','finance-store.py')
settlement=load('settlement_keeper','settlement-engine.py')
pq=load('pq_keeper','pq_crypto.py')

def run_once(now=None, live_only=True):
    now=time.time() if now is None else float(now)
    observation=settlement.fetch_prestocks()
    results=[]
    if live_only and not observation.get('live'):
        return {'ok':False,'reason':'live_prestocks_required','observation':{'live':False,'fallbackReason':observation.get('fallbackReason')},'settled':[]}
    for m in market_store.list_markets():
        if m.get('status')!='OPEN' or not settlement.is_due(m,now): continue
        try:
            proof=settlement.resolve_observation(m,observation)
            signed=pq.hybrid_sign(proof)
            envelope={'observation':proof,'signature':signed,'suite':'Stocklana-Phantasma-PQ-v2'}
            resolved=market_store.resolve(m['id'],{'outcome':proof['outcome'],'proof':envelope})
            receipt=finance_store.record_system_event('automatic_market_resolution','stocklana.keeper',{'marketId':m['id'],'outcome':proof['outcome'],'observationCommitment':signed['commitment']})
            results.append({'marketId':m['id'],'outcome':proof['outcome'],'receiptId':receipt['id'],'proofCommitment':signed['commitment']})
        except Exception as e:
            results.append({'marketId':m.get('id'),'error':str(e)})
    return {'ok':True,'sourceLive':observation.get('live',False),'observedAt':observation['fetchedAt'],'settled':results}
