import hashlib,json,os,time,uuid,urllib.request,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
import pq_crypto, importlib.util
spec=importlib.util.spec_from_file_location('finance_store_local',ROOT/'src'/'finance-store.py'); finance_store=importlib.util.module_from_spec(spec); spec.loader.exec_module(finance_store)
DB=ROOT/'data'/'card-policies.json'
def _load():
 try:return json.loads(DB.read_text()) if DB.exists() else {'policies':{}}
 except:return {'policies':{}}
def _save(d):
 t=DB.with_suffix('.tmp');t.write_text(json.dumps(d,indent=2,sort_keys=True));t.replace(DB)
def create_policy(user,amount,merchant=None,mcc=None,ttl=900):
 amount=float(amount)
 if amount<=0:raise ValueError('invalid_amount')
 pid='cardpol_'+uuid.uuid4().hex[:18];key='card:'+pid;finance_store.lock(user,key,amount,'USDC');now=int(time.time())
 p={'id':pid,'user':user,'maxAmountUSDC':amount,'merchant':merchant,'mcc':mcc,'usesRemaining':1,'status':'AUTHORIZED_RESERVED','createdAt':now,'expiresAt':now+int(ttl),'fundingLock':key}
 p['pqProof']=pq_crypto.hybrid_sign({k:v for k,v in p.items() if k!='pqProof'});d=_load();d['policies'][pid]=p;_save(d);return p
def capture(user,pid,amount,provider_receipt=None):
 d=_load();p=d['policies'].get(pid)
 if not p or p['user']!=user:raise ValueError('card_policy_not_found')
 if p['status']!='AUTHORIZED_RESERVED' or p['expiresAt']<int(time.time()) or p['usesRemaining']!=1:raise ValueError('card_policy_not_usable')
 amount=float(amount)
 if amount>p['maxAmountUSDC']+1e-9:raise ValueError('amount_exceeds_policy')
 finance_store.settle_locked(user,p['fundingLock'],'stocklana:card-clearing',amount,'USDC');remaining=p['maxAmountUSDC']-amount
 if remaining>1e-9:finance_store.release_locked(user,p['fundingLock'],'USDC')
 p.update({'status':'CAPTURED','capturedUSDC':amount,'usesRemaining':0,'capturedAt':int(time.time()),'providerReceiptCommitment':pq_crypto.blake_commit(str(provider_receipt).encode()) if provider_receipt else None});_save(d);return p
def cancel(user,pid):
 d=_load();p=d['policies'].get(pid)
 if not p or p['user']!=user:raise ValueError('card_policy_not_found')
 if p['status']!='AUTHORIZED_RESERVED':raise ValueError('card_policy_not_reservable')
 finance_store.release_locked(user,p['fundingLock'],'USDC');p['status']='CANCELLED';p['usesRemaining']=0;p['cancelledAt']=int(time.time());_save(d);return p
def issue_virtual(user,pid):
 d=_load();p=d['policies'].get(pid)
 if not p or p['user']!=user:raise ValueError('card_policy_not_found')
 url=os.getenv('CARD_ISSUER_PROXY_URL'); token=os.getenv('CARD_ISSUER_PROXY_TOKEN')
 if not url or not token:return {'ready':False,'reason':'issuer_credentials_not_configured','policyId':pid,'providerBoundary':'CARD_ISSUER_PROXY_URL'}
 body=json.dumps({'externalUserId':user,'policyId':pid,'amountLimit':p['maxAmountUSDC'],'currency':'USD','uses':1,'expiresAt':p['expiresAt'],'merchant':p.get('merchant'),'mcc':p.get('mcc')}).encode();req=urllib.request.Request(url,data=body,method='POST',headers={'Authorization':'Bearer '+token,'content-type':'application/json','User-Agent':'Stocklana/1.0'})
 with urllib.request.urlopen(req,timeout=15) as r:res=json.loads(r.read().decode())
 # Never persist PAN/CVV. Only the provider's opaque card/token id.
 opaque=res.get('cardToken') or res.get('id');p['providerCardIdCommitment']=pq_crypto.blake_commit(str(opaque).encode()) if opaque else None;p['providerStatus']=res.get('status','CREATED');_save(d)
 return {'ready':True,'policyId':pid,'providerStatus':p['providerStatus'],'cardToken':opaque,'hostedRevealUrl':res.get('hostedRevealUrl') or res.get('revealUrl'),'walletPassUrl':res.get('walletPassUrl') or res.get('applePayUrl') or res.get('googlePayUrl'),'checkoutToken':res.get('checkoutToken'),'sensitiveDataStored':False}
def get_policy(user,pid):
 p=_load()['policies'].get(pid);return p if p and p['user']==user else None
def capabilities():return {'singleUsePolicies':True,'jitReserve':True,'captureConservesLedger':True,'providerIssuanceConfigured':bool(os.getenv('CARD_ISSUER_PROXY_URL') and os.getenv('CARD_ISSUER_PROXY_TOKEN')),'panStorage':False}
