import base64, hashlib, json, secrets, time, threading
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
ROOT=Path(__file__).resolve().parents[1]; DB=ROOT/'data'/'auth.json'; LOCK=threading.RLock()
ALPH='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
def b58decode(s):
 n=0
 for c in s:n=n*58+ALPH.index(c)
 raw=n.to_bytes((n.bit_length()+7)//8,'big') if n else b''
 return b'\0'*(len(s)-len(s.lstrip('1')))+raw
def _load():
 try:return json.loads(DB.read_text()) if DB.exists() else {'challenges':{},'sessions':{},'agents':{}}
 except:return {'challenges':{},'sessions':{},'agents':{}}
def _save(d):
 t=DB.with_suffix('.tmp'); t.write_text(json.dumps(d,indent=2,sort_keys=True)); t.replace(DB)
def challenge(wallet):
 if len(b58decode(wallet))!=32:raise ValueError('invalid_solana_wallet')
 with LOCK:
  d=_load(); nonce=secrets.token_urlsafe(24); now=int(time.time())
  message=f'STOCKLANA_AUTH_V1\nwallet={wallet}\nnonce={nonce}\nissued={now}\npurpose=financial-session'
  d['challenges'][nonce]={'wallet':wallet,'message':message,'issuedAt':now,'expiresAt':now+300,'used':False};_save(d)
  return {'nonce':nonce,'message':message,'expiresAt':now+300}
def verify(wallet,nonce,signature_b64):
 with LOCK:
  d=_load(); c=d['challenges'].get(nonce); now=int(time.time())
  if not c or c['used'] or c['wallet']!=wallet or c['expiresAt']<now:raise ValueError('invalid_or_expired_challenge')
  Ed25519PublicKey.from_public_bytes(b58decode(wallet)).verify(base64.b64decode(signature_b64),c['message'].encode())
  c['used']=True; token=secrets.token_urlsafe(36); digest=hashlib.blake2b(token.encode(),digest_size=32,person=b'STOCKLANA-SESSION').hexdigest()
  d['sessions'][digest]={'subject':wallet,'kind':'human','createdAt':now,'expiresAt':now+86400,'scopes':['vault:read','vault:write','market:trade','position:transfer','pay:send','agent:create']};_save(d)
  return {'token':token,'subject':wallet,'expiresAt':now+86400,'scopes':d['sessions'][digest]['scopes']}
def issue_agent(owner,agent_id,scopes=None,ttl=604800):
 with LOCK:
  d=_load(); token='sat_'+secrets.token_urlsafe(40); digest=hashlib.blake2b(token.encode(),digest_size=32,person=b'STOCKLANA-AGENT').hexdigest();now=int(time.time())
  scopes=scopes or ['vault:read','market:trade','pay:send']; d['agents'][digest]={'subject':agent_id,'owner':owner,'kind':'agent','scopes':scopes,'createdAt':now,'expiresAt':now+int(ttl),'revoked':False};_save(d)
  return {'token':token,'subject':agent_id,'owner':owner,'scopes':scopes,'expiresAt':now+int(ttl),'returnedOnce':True}
def resolve(token,scope=None):
 if not token:return None
 d=_load();now=int(time.time())
 for person,kind in ((d.get('sessions',{}),'human'),(d.get('agents',{}),'agent')):
  digest=hashlib.blake2b(token.encode(),digest_size=32,person=b'STOCKLANA-SESSION' if kind=='human' else b'STOCKLANA-AGENT').hexdigest(); rec=person.get(digest)
  if rec and rec.get('expiresAt',0)>=now and not rec.get('revoked',False):
   if scope and scope not in rec.get('scopes',[]):raise PermissionError('scope_denied')
   return rec
 return None
