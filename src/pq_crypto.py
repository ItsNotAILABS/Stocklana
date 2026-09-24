import base64, hashlib, json, os, subprocess, tempfile
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parents[1]
KEY_DIR = ROOT / 'data' / 'pq-keys'
KEY_DIR.mkdir(parents=True, exist_ok=True)

MLDSA_PRIV = KEY_DIR / 'mldsa65.private.pem'
MLDSA_PUB = KEY_DIR / 'mldsa65.public.pem'
MLKEM_PRIV = KEY_DIR / 'mlkem768.private.pem'
MLKEM_PUB = KEY_DIR / 'mlkem768.public.pem'
ED_PRIV = KEY_DIR / 'ed25519.private.pem'
ED_PUB = KEY_DIR / 'ed25519.public.pem'
X_PRIV = KEY_DIR / 'x25519.private.pem'
X_PUB = KEY_DIR / 'x25519.public.pem'

DOMAIN = b'STOCKLANA-PHANTASMA-PQ-V2'


def _run(args, input_bytes=None):
    p = subprocess.run(args, input=input_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError(f"openssl failed: {' '.join(args)} :: {p.stderr.decode(errors='ignore')}")
    return p.stdout


def _gen(algorithm, priv, pub):
    created = False
    if not priv.exists():
        _run(['openssl','genpkey','-algorithm',algorithm,'-out',str(priv)])
        os.chmod(priv, 0o600)
        created = True
    # Public material must always be derived from the active private key.
    # This prevents a fresh deployment from pairing newly generated private
    # keys with stale public keys shipped in a release archive.
    if created or not pub.exists():
        _run(['openssl','pkey','-in',str(priv),'-pubout','-out',str(pub)])
    else:
        derived = _run(['openssl','pkey','-in',str(priv),'-pubout'])
        if pub.read_bytes() != derived:
            pub.write_bytes(derived)


def ensure_keys():
    _gen('ML-DSA-65', MLDSA_PRIV, MLDSA_PUB)
    _gen('ML-KEM-768', MLKEM_PRIV, MLKEM_PUB)
    _gen('ED25519', ED_PRIV, ED_PUB)
    _gen('X25519', X_PRIV, X_PUB)
    return public_metadata()


def canonical_bytes(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), default=str).encode()


def blake_commit(data: bytes, size=64):
    return hashlib.blake2b(data, digest_size=size, person=b'STKLNA-PQ-COMMIT').hexdigest()


def _fingerprint(pub_path):
    der = _run(['openssl','pkey','-pubin','-in',str(pub_path),'-outform','DER'])
    return hashlib.blake2b(der, digest_size=32, person=b'STKLNA-PQ-KEY').hexdigest()


def public_metadata():
    return {
        'suite': 'Stocklana-Phantasma-PQ-v2',
        'receiptSignature': ['ML-DSA-65', 'Ed25519'],
        'vaultKEM': ['ML-KEM-768', 'X25519'],
        'payloadCipher': 'AES-256-GCM',
        'commitment': 'BLAKE2b-512',
        'mldsaFingerprint': _fingerprint(MLDSA_PUB) if MLDSA_PUB.exists() else None,
        'mlkemFingerprint': _fingerprint(MLKEM_PUB) if MLKEM_PUB.exists() else None,
        'ed25519Fingerprint': _fingerprint(ED_PUB) if ED_PUB.exists() else None,
        'x25519Fingerprint': _fingerprint(X_PUB) if X_PUB.exists() else None,
    }


def hybrid_sign(obj):
    ensure_keys()
    msg = canonical_bytes(obj)
    with tempfile.TemporaryDirectory() as td:
        td = Path(td); m = td/'m'; m.write_bytes(msg)
        mldsa = td/'mldsa.sig'; ed = td/'ed.sig'
        _run(['openssl','pkeyutl','-sign','-inkey',str(MLDSA_PRIV),'-in',str(m),'-out',str(mldsa)])
        _run(['openssl','pkeyutl','-sign','-rawin','-inkey',str(ED_PRIV),'-in',str(m),'-out',str(ed)])
        return {
            'suite': 'ML-DSA-65+Ed25519',
            'commitment': blake_commit(msg),
            'mldsa65': base64.b64encode(mldsa.read_bytes()).decode(),
            'ed25519': base64.b64encode(ed.read_bytes()).decode(),
            'mldsaKey': _fingerprint(MLDSA_PUB),
            'ed25519Key': _fingerprint(ED_PUB),
        }


def hybrid_verify(obj, sig):
    ensure_keys(); msg = canonical_bytes(obj)
    if sig.get('commitment') != blake_commit(msg): return False
    with tempfile.TemporaryDirectory() as td:
        td = Path(td); m = td/'m'; m.write_bytes(msg)
        s1 = td/'s1'; s1.write_bytes(base64.b64decode(sig['mldsa65']))
        s2 = td/'s2'; s2.write_bytes(base64.b64decode(sig['ed25519']))
        p1 = subprocess.run(['openssl','pkeyutl','-verify','-pubin','-inkey',str(MLDSA_PUB),'-in',str(m),'-sigfile',str(s1)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        p2 = subprocess.run(['openssl','pkeyutl','-verify','-rawin','-pubin','-inkey',str(ED_PUB),'-in',str(m),'-sigfile',str(s2)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        return p1.returncode == 0 and p2.returncode == 0


def _derive_hybrid_key(mlkem_secret: bytes, x25519_secret: bytes, context: bytes):
    return hashlib.blake2b(DOMAIN + mlkem_secret + x25519_secret + context, digest_size=32, person=b'STKLNA-PQ-KDF').digest()


def pq_seal(obj, context='vault-journal'):
    ensure_keys(); plaintext = canonical_bytes(obj); context_b = context.encode()
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        kem_ct = td/'kem.ct'; kem_ss = td/'kem.ss'
        _run(['openssl','pkeyutl','-encap','-inkey',str(MLKEM_PUB),'-pubin','-out',str(kem_ct),'-secret',str(kem_ss)])
        eph_priv = td/'eph.private.pem'; eph_pub = td/'eph.public.pem'; x_ss = td/'x.ss'
        _run(['openssl','genpkey','-algorithm','X25519','-out',str(eph_priv)])
        _run(['openssl','pkey','-in',str(eph_priv),'-pubout','-out',str(eph_pub)])
        _run(['openssl','pkeyutl','-derive','-inkey',str(eph_priv),'-peerkey',str(X_PUB),'-out',str(x_ss)])
        wrap_key = _derive_hybrid_key(kem_ss.read_bytes(), x_ss.read_bytes(), context_b)
        dek = os.urandom(32)
        wrap_nonce = os.urandom(12); data_nonce = os.urandom(12)
        wrapped_dek = AESGCM(wrap_key).encrypt(wrap_nonce, dek, DOMAIN + context_b)
        ciphertext = AESGCM(dek).encrypt(data_nonce, plaintext, DOMAIN + context_b)
        return {
            'version': 2,
            'suite': 'ML-KEM-768+X25519/AES-256-GCM',
            'commitment': blake_commit(plaintext),
            'context': context,
            'kemCiphertext': base64.b64encode(kem_ct.read_bytes()).decode(),
            'ephemeralX25519Public': base64.b64encode(eph_pub.read_bytes()).decode(),
            'wrapNonce': base64.b64encode(wrap_nonce).decode(),
            'wrappedDEK': base64.b64encode(wrapped_dek).decode(),
            'dataNonce': base64.b64encode(data_nonce).decode(),
            'ciphertext': base64.b64encode(ciphertext).decode(),
            'mlkemKey': _fingerprint(MLKEM_PUB),
            'x25519Key': _fingerprint(X_PUB),
        }


def pq_open(sealed):
    ensure_keys(); context_b = sealed['context'].encode()
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        kem_ct = td/'kem.ct'; kem_ct.write_bytes(base64.b64decode(sealed['kemCiphertext']))
        kem_ss = td/'kem.ss'
        _run(['openssl','pkeyutl','-decap','-inkey',str(MLKEM_PRIV),'-in',str(kem_ct),'-secret',str(kem_ss)])
        eph_pub = td/'eph.public.pem'; eph_pub.write_bytes(base64.b64decode(sealed['ephemeralX25519Public']))
        x_ss = td/'x.ss'
        _run(['openssl','pkeyutl','-derive','-inkey',str(X_PRIV),'-peerkey',str(eph_pub),'-out',str(x_ss)])
        wrap_key = _derive_hybrid_key(kem_ss.read_bytes(), x_ss.read_bytes(), context_b)
        dek = AESGCM(wrap_key).decrypt(base64.b64decode(sealed['wrapNonce']), base64.b64decode(sealed['wrappedDEK']), DOMAIN + context_b)
        plaintext = AESGCM(dek).decrypt(base64.b64decode(sealed['dataNonce']), base64.b64decode(sealed['ciphertext']), DOMAIN + context_b)
        if blake_commit(plaintext) != sealed['commitment']:
            raise ValueError('commitment_mismatch')
        return json.loads(plaintext)
