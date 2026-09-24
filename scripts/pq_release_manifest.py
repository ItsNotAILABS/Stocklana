#!/usr/bin/env python3
import json, pathlib, sys, time, shutil
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'src'))
import pq_crypto
EXCLUDE = {'release-manifest.json','RELEASE-SIGNING-V9.json','RELEASE-SIGNING-V10.json'}
# Synchronize shipped verification keys with the active signing keys BEFORE
# computing the release manifest. Private keys never leave data/pq-keys.
pq_crypto.ensure_keys()
pubdir=ROOT/'public'/'crypto'; pubdir.mkdir(parents=True,exist_ok=True)
for name in ['mldsa65','mlkem768','ed25519','x25519']:
    shutil.copy2(ROOT/'data'/'pq-keys'/f'{name}.public.pem', pubdir/f'{name}.public.pem')
files=[]
for p in sorted(ROOT.rglob('*')):
    if not p.is_file(): continue
    rel=p.relative_to(ROOT).as_posix()
    if rel in EXCLUDE or '/pq-keys/' in '/'+rel or rel.endswith('.pyc') or '__pycache__/' in rel: continue
    data=p.read_bytes()
    files.append({'path':rel,'bytes':len(data),'blake2b512':pq_crypto.blake_commit(data)})
core={'release':'stocklana-tokenized-equities','version':'v10-full-v2-product-pq','generatedAt':int(time.time()*1000),'proofSuite':pq_crypto.public_metadata(),'files':files}
core['rootCommitment']=pq_crypto.blake_commit(pq_crypto.canonical_bytes(files))
sig=pq_crypto.hybrid_sign(core)
assert pq_crypto.hybrid_verify(core, sig), 'manifest_signature_verification_failed'
core['hybridSignature']=sig
(ROOT/'release-manifest.json').write_text(json.dumps(core,indent=2))
print(json.dumps({'files':len(files),'rootCommitment':core['rootCommitment'],'suite':sig['suite'],'verified':True},indent=2))
