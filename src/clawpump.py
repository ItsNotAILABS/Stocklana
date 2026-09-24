import json,os,urllib.parse,urllib.request,uuid
BASE='https://clawpump.tech/api/v1'
def _req(path,method='GET',body=None,idem=None):
 key=os.getenv('CLAWPUMP_API_KEY')
 if not key:return {'ready':False,'reason':'CLAWPUMP_API_KEY_not_configured','path':path}
 h={'Authorization':'Bearer '+key,'User-Agent':'Stocklana/1.0','Content-Type':'application/json'}
 if idem:h['Idempotency-Key']=idem
 data=json.dumps(body).encode() if body is not None else None
 req=urllib.request.Request(BASE+path,data=data,method=method,headers=h)
 try:
  with urllib.request.urlopen(req,timeout=120) as r:return {'ready':True,'status':r.status,'data':json.loads(r.read().decode()),'headers':dict(r.headers)}
 except urllib.error.HTTPError as e:
  raw=e.read().decode();
  try: payload=json.loads(raw)
  except: payload={'error':raw[:1000]}
  return {'ready':False,'status':e.code,'data':payload,'headers':dict(e.headers)}
def pump_pairs():return _req('/pump-pairs')
def self_funded_preflight(payload):return _req('/launch/self-funded','POST',{**payload,'preflight':True})
def self_funded_launch(payload,tx_signature,preflight_token):return _req('/launch/self-funded','POST',{**payload,'txSignature':tx_signature,'preflightToken':preflight_token})
def robinhood_launch(payload,idempotency_key=None):return _req('/launch/pons','POST',payload,idempotency_key or str(uuid.uuid4()))
def uniswap_launch(payload,idempotency_key=None):return _req('/launch/pools','POST',payload,idempotency_key or str(uuid.uuid4()))
def capabilities():return {'optional':True,'base':BASE,'configured':bool(os.getenv('CLAWPUMP_API_KEY')),'routes':['pump custom quote pair','self-funded preflight+proof','Robinhood Chain/Pons','Uniswap/pools.trade'],'idempotency':True}
