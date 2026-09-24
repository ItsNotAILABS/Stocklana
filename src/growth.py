import json,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DB=ROOT/'data'/'growth.json'
def _load():
 try:return json.loads(DB.read_text()) if DB.exists() else {'codes':{},'events':[]}
 except:return {'codes':{},'events':[]}
def _save(d):
 t=DB.with_suffix('.tmp');t.write_text(json.dumps(d,indent=2,sort_keys=True));t.replace(DB)
def create_referral(owner,kind='market',target=None,share_bps=1000):
 code='stk_'+uuid.uuid4().hex[:10];d=_load();d['codes'][code]={'code':code,'owner':owner,'kind':kind,'target':target,'shareBps':min(max(int(share_bps),0),5000),'createdAt':int(time.time()),'clicks':0,'conversions':0,'revenueUSDC':0};_save(d);return d['codes'][code]
def record(code,event,revenue_usdc=0):
 d=_load();c=d['codes'].get(code)
 if not c:raise ValueError('referral_not_found')
 if event=='click':c['clicks']+=1
 if event=='conversion':c['conversions']+=1
 c['revenueUSDC']+=float(revenue_usdc);ev={'code':code,'event':event,'revenueUSDC':float(revenue_usdc),'at':int(time.time())};d['events'].append(ev);_save(d);return {'referral':c,'event':ev}
def capabilities():return {'experiments':['referral market links','creator fee share links'],'attribution':True,'revenueTracking':True}
