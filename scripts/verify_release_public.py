#!/usr/bin/env python3
import base64, hashlib, json, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'release-manifest.json').read_text())
sig=manifest.pop('hybridSignature')
msg=json.dumps(manifest,sort_keys=True,separators=(',',':'),default=str).encode()
commit=hashlib.blake2b(msg,digest_size=64,person=b'STKLNA-PQ-COMMIT').hexdigest()
assert commit==sig['commitment'],'manifest commitment mismatch'
with tempfile.TemporaryDirectory() as td:
 td=Path(td);m=td/'m';m.write_bytes(msg);s1=td/'mldsa.sig';s2=td/'ed.sig';s1.write_bytes(base64.b64decode(sig['mldsa65']));s2.write_bytes(base64.b64decode(sig['ed25519']))
 p1=subprocess.run(['openssl','pkeyutl','-verify','-pubin','-inkey',str(ROOT/'public/crypto/mldsa65.public.pem'),'-in',str(m),'-sigfile',str(s1)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 p2=subprocess.run(['openssl','pkeyutl','-verify','-rawin','-pubin','-inkey',str(ROOT/'public/crypto/ed25519.public.pem'),'-in',str(m),'-sigfile',str(s2)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 assert p1.returncode==0, p1.stderr.decode()
 assert p2.returncode==0, p2.stderr.decode()
print('PASS public-only release verification ML-DSA-65+Ed25519')
