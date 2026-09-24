import base64, json, os, time, uuid, hashlib, sys, threading, functools
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

DATA = Path(__file__).resolve().parents[1] / 'data'
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pq_crypto
DATA.mkdir(exist_ok=True)
DB = DATA / 'finance.json'
JOURNAL_KEY_ENVELOPE = DATA / 'journal-key-envelope.json'
_JOURNAL_DEK = None
STATE_LOCK = threading.RLock()

def serialized(fn):
    @functools.wraps(fn)
    def wrapped(*args, **kwargs):
        with STATE_LOCK:
            return fn(*args, **kwargs)
    return wrapped



def _default():
    return {
        'accounts': {}, 'receipts': [], 'receiptHead': '0'*128,
        'transfers': [], 'positionTransfers': [], 'depositRefs': {},
        'encryptedJournal': [], 'pendingWithdrawals': {}, 'pqAnchors': [], 'receiptSequence': 0
    }


def _load():
    if not DB.exists():
        return _default()
    try:
        d = json.loads(DB.read_text())
        base = _default(); base.update(d); return base
    except Exception:
        return _default()


def _save(db):
    tmp = DB.with_suffix('.tmp')
    tmp.write_text(json.dumps(db, indent=2, sort_keys=True))
    tmp.replace(DB)


def _acct(db, user):
    a = db['accounts'].setdefault(user, {
        'user': user,
        'balances': {'USDC': 0.0, 'SOL': 0.0},
        'subaccounts': {'CASH': {'USDC': 0.0}, 'TRADING': {'USDC': 0.0}, 'RESERVE': {'USDC': 0.0}},
        'locked': {}, 'createdAt': int(time.time()*1000)
    })
    a.setdefault('balances', {'USDC': 0.0, 'SOL': 0.0})
    a.setdefault('locked', {})
    if 'subaccounts' not in a:
        a['subaccounts'] = {
            'CASH': {'USDC': float(a['balances'].get('USDC', 0.0))},
            'TRADING': {'USDC': 0.0},
            'RESERVE': {'USDC': 0.0}
        }
    else:
        a['subaccounts'].setdefault('CASH', {'USDC': 0.0})
        a['subaccounts'].setdefault('TRADING', {'USDC': 0.0})
        a['subaccounts'].setdefault('RESERVE', {'USDC': 0.0})
    return a


def _journal_key():
    global _JOURNAL_DEK
    if _JOURNAL_DEK is not None: return _JOURNAL_DEK
    if JOURNAL_KEY_ENVELOPE.exists():
        try:
            env=json.loads(JOURNAL_KEY_ENVELOPE.read_text()); obj=pq_crypto.pq_open(env); _JOURNAL_DEK=base64.b64decode(obj['dek'])
        except Exception:
            # Release archives intentionally exclude private PQ keys. A copied
            # envelope can therefore belong to the build machine's old key epoch.
            # Preserve it as historical proof material and rotate a fresh journal
            # root for this deployment; never silently reuse an undecryptable key.
            stale=JOURNAL_KEY_ENVELOPE.with_name(f'journal-key-envelope.stale.{int(time.time())}.json')
            JOURNAL_KEY_ENVELOPE.replace(stale)
    if _JOURNAL_DEK is None:
        _JOURNAL_DEK=os.urandom(32); env=pq_crypto.pq_seal({'dek':base64.b64encode(_JOURNAL_DEK).decode(),'purpose':'Stocklana encrypted journal root','epochCreatedAt':int(time.time())},'stocklana-journal-root-v3'); JOURNAL_KEY_ENVELOPE.write_text(json.dumps(env,indent=2,sort_keys=True)); os.chmod(JOURNAL_KEY_ENVELOPE,0o600)
    return _JOURNAL_DEK

def _journal_encrypt(payload, receipt_id):
    # High-throughput journal design: one ML-KEM-768+X25519 wrapped root DEK,
    # then independent AES-256-GCM records with unique nonces. PQ KEM is paid
    # once per journal-key epoch rather than once per payment.
    key=_journal_key(); nonce=os.urandom(12); aad=('STOCKLANA-JOURNAL-V3:'+receipt_id).encode(); pt=pq_crypto.canonical_bytes(payload); ct=AESGCM(key).encrypt(nonce,pt,aad)
    return {'version':3,'suite':'ML-KEM-768+X25519-wrapped-DEK/AES-256-GCM','commitment':pq_crypto.blake_commit(pt),'nonce':base64.b64encode(nonce).decode(),'ciphertext':base64.b64encode(ct).decode(),'aad':base64.b64encode(aad).decode()}

def _append_private_journal(db, receipt_id, payload):
    encrypted = _journal_encrypt(payload,receipt_id)
    db['encryptedJournal'].append({'receiptId': receipt_id, **encrypted})
    db['encryptedJournal'] = db['encryptedJournal'][-4096:]
    return True

_HIGH_RISK={'verified_deposit','withdrawal_reserved','withdrawal_settled','locked_settlement'}
_ANCHOR_EVERY=16
def _receipt(db, kind, actor, payload):
    now=int(time.time()*1000); payload_commitment=pq_crypto.blake_commit(pq_crypto.canonical_bytes(payload)); seq=int(db.get('receiptSequence',0))+1; db['receiptSequence']=seq
    public_payload={'kind':kind,'actor':actor,'payloadCommitment':payload_commitment,'at':now,'prev':db['receiptHead'],'sequence':seq,'suite':'Stocklana-Phantasma-PQ-v3'}
    commitment=pq_crypto.blake_commit(pq_crypto.canonical_bytes(public_payload)); signed=kind in _HIGH_RISK
    signature=pq_crypto.hybrid_sign(public_payload) if signed else None
    r={'id':f'rcpt_{commitment[:20]}','kind':kind,'actor':actor,'at':now,'sequence':seq,'payloadCommitment':payload_commitment,'prevCommitment':db['receiptHead'],'commitment':commitment,'signature':signature,'proofSuite':'BLAKE2b-512 chain + ML-DSA-65/Ed25519 anchors','pqFinality':'INDIVIDUAL' if signed else 'BATCH_PENDING','privatePayloadEncrypted':False}
    db['receiptHead']=commitment; r['privatePayloadEncrypted']=_append_private_journal(db,r['id'],payload); db['receipts'].append(r); db['receipts']=db['receipts'][-2048:]
    if seq % _ANCHOR_EVERY==0:
        batch=db['receipts'][-_ANCHOR_EVERY:]; anchor={'type':'FINANCE_BATCH_ANCHOR','fromSequence':batch[0]['sequence'],'toSequence':batch[-1]['sequence'],'head':commitment,'receiptCommitments':[x['commitment'] for x in batch],'at':now}; sig=pq_crypto.hybrid_sign(anchor); rec={**anchor,'signature':sig}; db.setdefault('pqAnchors',[]).append(rec); db['pqAnchors']=db['pqAnchors'][-256:];
        for x in batch:
            if x.get('pqFinality')=='BATCH_PENDING': x['pqFinality']='BATCH_ANCHORED';x['anchorToSequence']=seq
    return r

def account(user):
    db = _load(); a = _acct(db, user); _save(db)
    return {**a, 'receiptHead': db['receiptHead'], 'encryptedJournalEnabled': True, 'postQuantum': pq_crypto.public_metadata()}


@serialized
def credit(user, amount, asset='USDC', source='manual', reference=None):
    amount = float(amount)
    if amount <= 0: raise ValueError('invalid_amount')
    db = _load(); a = _acct(db, user)
    a['balances'][asset] = float(a['balances'].get(asset, 0)) + amount
    a['subaccounts'].setdefault('CASH', {})[asset] = float(a['subaccounts'].get('CASH', {}).get(asset, 0)) + amount
    rc = _receipt(db, 'vault_credit', user, {'asset':asset,'amount':amount,'source':source,'reference':reference})
    _save(db); return {'account':a,'receipt':rc}


@serialized
def debit(user, amount, asset='USDC', destination='external'):
    amount = float(amount)
    if amount <= 0: raise ValueError('invalid_amount')
    db = _load(); a = _acct(db, user); bal = float(a['balances'].get(asset, 0))
    if bal + 1e-9 < amount: raise ValueError('insufficient_balance')
    a['balances'][asset] = bal - amount
    cash = a['subaccounts'].setdefault('CASH', {})
    cash[asset] = max(0.0, float(cash.get(asset, 0)) - amount)
    rc = _receipt(db, 'vault_debit', user, {'asset':asset,'amount':amount,'destination':destination})
    _save(db); return {'account':a,'receipt':rc}


@serialized
def move_subaccount(user, amount, source='CASH', destination='TRADING', asset='USDC'):
    if source == destination: raise ValueError('same_subaccount')
    amount = float(amount)
    if amount <= 0: raise ValueError('invalid_amount')
    db = _load(); a = _acct(db, user)
    src = a['subaccounts'].setdefault(source, {})
    dst = a['subaccounts'].setdefault(destination, {})
    if float(src.get(asset, 0)) + 1e-9 < amount: raise ValueError('insufficient_subaccount_balance')
    src[asset] = float(src.get(asset, 0)) - amount
    dst[asset] = float(dst.get(asset, 0)) + amount
    rc = _receipt(db, 'subaccount_transfer', user, {'asset':asset,'amount':amount,'source':source,'destination':destination})
    _save(db); return {'account':a,'receipt':rc}


@serialized
def transfer(sender, recipient, amount, asset='USDC', memo=''):
    if not recipient or recipient == sender: raise ValueError('invalid_recipient')
    amount = float(amount)
    if amount <= 0: raise ValueError('invalid_amount')
    db = _load(); s = _acct(db, sender); r = _acct(db, recipient)
    if float(s['balances'].get(asset,0)) + 1e-9 < amount: raise ValueError('insufficient_balance')
    s['balances'][asset] = float(s['balances'].get(asset,0)) - amount
    r['balances'][asset] = float(r['balances'].get(asset,0)) + amount
    sc = s['subaccounts'].setdefault('CASH', {}); rcash = r['subaccounts'].setdefault('CASH', {})
    sc[asset] = max(0.0, float(sc.get(asset,0)) - amount)
    rcash[asset] = float(rcash.get(asset,0)) + amount
    tx = {'id':f'tx_{uuid.uuid4().hex[:12]}','sender':sender,'recipient':recipient,'asset':asset,'amount':amount,'memo':memo,'at':int(time.time()*1000),'status':'SETTLED'}
    db['transfers'].append(tx)
    rc = _receipt(db, 'internal_transfer', sender, tx)
    _save(db); return {'transfer':tx,'senderAccount':s,'receipt':rc}


@serialized
def lock(user, key, amount, asset='USDC'):
    amount = float(amount)
    if amount < 0: raise ValueError('invalid_amount')
    db = _load(); a = _acct(db, user); current = float(a['locked'].get(key,0)); delta = amount-current
    if delta > 0:
        bal = float(a['balances'].get(asset,0))
        if bal + 1e-9 < delta: raise ValueError('insufficient_balance')
        a['balances'][asset] = bal-delta
        cash=a['subaccounts'].setdefault('CASH',{}); cash[asset]=max(0.0,float(cash.get(asset,0))-delta)
    elif delta < 0:
        a['balances'][asset] = float(a['balances'].get(asset,0)) + (-delta)
        cash=a['subaccounts'].setdefault('CASH',{}); cash[asset]=float(cash.get(asset,0))+(-delta)
    a['locked'][key] = amount
    rc = _receipt(db, 'collateral_lock', user, {'key':key,'asset':asset,'amount':amount})
    _save(db); return {'account':a,'receipt':rc}


@serialized
def consume_locked(user,key,amount,asset='USDC'):
    amount = float(amount); db = _load(); a = _acct(db,user); cur = float(a['locked'].get(key,0))
    if cur + 1e-9 < amount: raise ValueError('insufficient_locked_collateral')
    a['locked'][key] = cur-amount
    rc = _receipt(db,'collateral_consume',user,{'key':key,'asset':asset,'amount':amount})
    _save(db); return {'account':a,'receipt':rc}


@serialized
def release_locked(user,key,asset='USDC'):
    db = _load(); a = _acct(db,user); amt = float(a['locked'].get(key,0)); a['locked'][key] = 0.0
    a['balances'][asset] = float(a['balances'].get(asset,0)) + amt
    cash=a['subaccounts'].setdefault('CASH',{}); cash[asset]=float(cash.get(asset,0))+amt
    rc = _receipt(db,'collateral_release',user,{'key':key,'asset':asset,'amount':amt})
    _save(db); return {'account':a,'receipt':rc}


@serialized
def record_position_transfer(sender,recipient,market_id,side,shares):
    db = _load(); tx = {'id':f'ptx_{uuid.uuid4().hex[:12]}','sender':sender,'recipient':recipient,'marketId':market_id,'side':side,'shares':float(shares),'at':int(time.time()*1000),'status':'SETTLED'}
    db['positionTransfers'].append(tx); rc = _receipt(db,'position_transfer',sender,tx); _save(db); return {'transfer':tx,'receipt':rc}


def receipts(limit=50):
    db = _load(); return {'head':db['receiptHead'],'receipts':list(reversed(db['receipts'][-int(limit):])),'encryptedJournalEntries':len(db.get('encryptedJournal',[])),'pqAnchors':list(reversed(db.get('pqAnchors',[])[-8:])),'batchAnchorEvery':_ANCHOR_EVERY}


@serialized
def credit_once(user, amount, asset='USDC', source='solana-deposit', reference=None):
    if not reference: raise ValueError('missing_reference')
    db = _load(); refs = db.setdefault('depositRefs',{})
    if reference in refs:
        return {'account':_acct(db,user),'receipt':refs[reference]['receipt'],'duplicate':True}
    amount = float(amount)
    if amount <= 0: raise ValueError('invalid_amount')
    a = _acct(db,user); a['balances'][asset] = float(a['balances'].get(asset,0)) + amount
    a['subaccounts'].setdefault('CASH', {})[asset] = float(a['subaccounts'].get('CASH', {}).get(asset,0)) + amount
    rc = _receipt(db,'verified_deposit',user,{'asset':asset,'amount':amount,'source':source,'reference':reference})
    refs[reference] = {'user':user,'asset':asset,'amount':amount,'receipt':rc,'at':int(time.time()*1000)}
    _save(db); return {'account':a,'receipt':rc,'duplicate':False}


@serialized
def record_system_event(kind, actor, payload):
    db = _load()
    rc = _receipt(db, kind, actor, payload)
    _save(db)
    return rc


@serialized
def request_withdrawal(user, amount, destination, asset='USDC'):
    amount=float(amount)
    if amount<=0: raise ValueError('invalid_amount')
    if not destination: raise ValueError('missing_destination')
    db=_load(); a=_acct(db,user)
    if float(a['balances'].get(asset,0))+1e-9<amount: raise ValueError('insufficient_balance')
    wid=f"wd_{uuid.uuid4().hex[:16]}"
    a['balances'][asset]=float(a['balances'].get(asset,0))-amount
    cash=a['subaccounts'].setdefault('CASH',{}); cash[asset]=max(0.0,float(cash.get(asset,0))-amount)
    a['locked'][wid]=amount
    intent={'id':wid,'user':user,'asset':asset,'amount':amount,'destination':destination,'status':'RESERVED','createdAt':int(time.time()*1000),'expiresAt':int(time.time()*1000)+15*60*1000}
    intent['authorization']=pq_crypto.hybrid_sign(intent)
    db['pendingWithdrawals'][wid]=intent
    rc=_receipt(db,'withdrawal_reserved',user,{'withdrawalId':wid,'asset':asset,'amount':amount,'destination':destination,'authorizationCommitment':intent['authorization']['commitment']})
    _save(db); return {'withdrawal':intent,'receipt':rc,'account':a}


@serialized
def confirm_withdrawal(withdrawal_id, chain_proof):
    db=_load(); w=db['pendingWithdrawals'].get(withdrawal_id)
    if not w: raise ValueError('withdrawal_not_found')
    if w['status']!='RESERVED': raise ValueError('withdrawal_not_reserved')
    a=_acct(db,w['user']); locked=float(a['locked'].get(withdrawal_id,0))
    if locked+1e-9<float(w['amount']): raise ValueError('withdrawal_reserve_missing')
    a['locked'][withdrawal_id]=0.0
    w['status']='SETTLED'; w['settledAt']=int(time.time()*1000); w['chainProof']=chain_proof
    rc=_receipt(db,'withdrawal_settled',w['user'],{'withdrawalId':withdrawal_id,'asset':w['asset'],'amount':w['amount'],'destination':w['destination'],'chainProof':chain_proof})
    _save(db); return {'withdrawal':w,'receipt':rc,'account':a}


@serialized
def cancel_withdrawal(user, withdrawal_id):
    db=_load(); w=db['pendingWithdrawals'].get(withdrawal_id)
    if not w or w['user']!=user: raise ValueError('withdrawal_not_found')
    if w['status']!='RESERVED': raise ValueError('withdrawal_not_reserved')
    a=_acct(db,user); amt=float(a['locked'].get(withdrawal_id,0)); a['locked'][withdrawal_id]=0.0
    a['balances'][w['asset']]=float(a['balances'].get(w['asset'],0))+amt
    cash=a['subaccounts'].setdefault('CASH',{}); cash[w['asset']]=float(cash.get(w['asset'],0))+amt
    w['status']='CANCELLED'; w['cancelledAt']=int(time.time()*1000)
    rc=_receipt(db,'withdrawal_cancelled',user,{'withdrawalId':withdrawal_id,'amount':amt,'asset':w['asset']})
    _save(db); return {'withdrawal':w,'receipt':rc,'account':a}


def withdrawal(withdrawal_id):
    db=_load(); return db.get('pendingWithdrawals',{}).get(withdrawal_id)

@serialized
def settle_locked(user,key,recipient,amount,asset='USDC'):
    amount=float(amount); db=_load(); a=_acct(db,user); r=_acct(db,recipient); cur=float(a['locked'].get(key,0))
    if amount<=0 or cur+1e-9<amount: raise ValueError('insufficient_locked_collateral')
    a['locked'][key]=cur-amount; r['balances'][asset]=float(r['balances'].get(asset,0))+amount
    rcash=r['subaccounts'].setdefault('CASH',{}); rcash[asset]=float(rcash.get(asset,0))+amount
    rc=_receipt(db,'locked_settlement',user,{'key':key,'recipient':recipient,'asset':asset,'amount':amount})
    _save(db); return {'account':a,'recipientAccount':r,'receipt':rc}

def conservation(asset='USDC'):
    db=_load(); balances=sum(float(a.get('balances',{}).get(asset,0)) for a in db['accounts'].values()); locked=sum(sum(float(v) for v in a.get('locked',{}).values()) for a in db['accounts'].values())
    return {'asset':asset,'available':balances,'locked':locked,'total':balances+locked,'accounts':len(db['accounts'])}
