import base64, json, time, uuid, hashlib, sys
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import pq_crypto
DB=ROOT/'data'/'payment-fabric.json'

def _load():
    if not DB.exists(): return {'handles':{},'devices':{},'intents':{},'usedNonces':{},'cashoutIntents':{}}
    try: return json.loads(DB.read_text())
    except: return {'handles':{},'devices':{},'intents':{},'usedNonces':{},'cashoutIntents':{}}

def _save(d):
    t=DB.with_suffix('.tmp'); t.write_text(json.dumps(d,indent=2,sort_keys=True)); t.replace(DB)

def canonical(o): return json.dumps(o,sort_keys=True,separators=(',',':')).encode()

def register_handle(user, handle):
    h=handle.lower().lstrip('@').strip()
    if not h or len(h)>32 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789._-' for c in h): raise ValueError('invalid_handle')
    d=_load(); owner=d['handles'].get(h)
    if owner and owner!=user: raise ValueError('handle_taken')
    d['handles'][h]=user; _save(d); return {'handle':'@'+h,'user':user}

def resolve_handle(handle): return _load()['handles'].get(handle.lower().lstrip('@'))

def register_device(user, device_id, ed25519_public_raw_b64):
    raw=base64.b64decode(ed25519_public_raw_b64); Ed25519PublicKey.from_public_bytes(raw)
    d=_load(); d['devices'][device_id]={'user':user,'publicKey':ed25519_public_raw_b64,'registeredAt':int(time.time()*1000),'revoked':False}; _save(d)
    return {'deviceId':device_id,'user':user,'fingerprint':hashlib.blake2b(raw,digest_size=20,person=b'MAQUE-DEVICE').hexdigest()}

def make_payment_request(payee, amount, asset='USDC', memo='', ttl=900):
    now=int(time.time())
    body={'v':1,'type':'MAQUE_PAY_REQUEST','payee':payee,'asset':asset,'amount':round(float(amount),6),'memo':memo[:140],'nonce':uuid.uuid4().hex,'issuedAt':now,'expiresAt':now+int(ttl)}
    return {**body,'proof':pq_crypto.hybrid_sign(body),'transport':{'qr':'maque://pay?payload='+base64.urlsafe_b64encode(canonical(body)).decode().rstrip('='),'nfcMime':'application/vnd.maque.pay+json'}}

def verify_offline_intent(intent, signature_b64):
    d=_load(); did=intent.get('deviceId'); dev=d['devices'].get(did)
    if not dev or dev['revoked']: raise ValueError('device_not_authorized')
    if dev['user']!=intent.get('payer'): raise ValueError('device_owner_mismatch')
    now=int(time.time())
    if int(intent.get('expiresAt',0))<now: raise ValueError('intent_expired')
    nonce=intent.get('nonce')
    if not nonce or nonce in d['usedNonces']: raise ValueError('replay_detected')
    Ed25519PublicKey.from_public_bytes(base64.b64decode(dev['publicKey'])).verify(base64.b64decode(signature_b64),canonical(intent))
    return True

def accept_offline_intent(intent, signature_b64):
    verify_offline_intent(intent,signature_b64); d=_load(); nonce=intent['nonce']
    d['usedNonces'][nonce]={'at':int(time.time()*1000),'payer':intent['payer']}
    iid='mpi_'+uuid.uuid4().hex[:18]
    rec={'id':iid,'intent':intent,'deviceSignature':signature_b64,'status':'VERIFIED_PENDING_SETTLEMENT','acceptedAt':int(time.time()*1000)}
    rec['pqProof']=pq_crypto.hybrid_sign({'id':iid,'intentCommitment':pq_crypto.blake_commit(canonical(intent)),'status':rec['status']})
    d['intents'][iid]=rec; _save(d); return rec

def cashout_intent(user, amount, destination_type, destination_ref):
    if destination_type not in {'debit_card','bank','solana','internal'}: raise ValueError('unsupported_destination')
    now=int(time.time()*1000); cid='cashout_'+uuid.uuid4().hex[:16]
    body={'id':cid,'user':user,'amountUSDC':float(amount),'destinationType':destination_type,'destinationRefCommitment':pq_crypto.blake_commit(str(destination_ref).encode()),'status':'ROUTE_REQUIRED','at':now}
    body['authorization']=pq_crypto.hybrid_sign({k:v for k,v in body.items() if k!='authorization'})
    d=_load(); d['cashoutIntents'][cid]=body; _save(d); return body

def capabilities():
    return {'fabric':'MAQUE Pay Fabric v1','humanAddressing':['@handle','QR','NFC','payment-link'],'offline':'Ed25519 device-signed intent + nonce/replay/expiry + PQ server receipt','settlementRails':['internal','Solana USDC'],'adapterRails':['debit_card','bank'],'note':'card/bank adapters create authenticated routing intents; provider settlement is not claimed until a provider receipt is attached'}
