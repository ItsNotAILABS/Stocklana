#!/usr/bin/env python3
import importlib.util, pathlib, tempfile, json
p = pathlib.Path(__file__).resolve().parents[1]/'src'/'pq_crypto.py'
spec=importlib.util.spec_from_file_location('pq',p); pq=importlib.util.module_from_spec(spec); spec.loader.exec_module(pq)
obj={'marketId':'mkt_openai_001','side':'YES','shares':17.25,'cash':93.5}
sig=pq.hybrid_sign(obj)
assert pq.hybrid_verify(obj,sig)
bad=dict(obj); bad['shares']=17.26
assert not pq.hybrid_verify(bad,sig)
sealed=pq.pq_seal(obj,'test-vault')
assert pq.pq_open(sealed)==obj
assert sealed['suite'].startswith('ML-KEM-768+X25519')
print(json.dumps({'ok':True,'suite':pq.public_metadata(),'signatureBytes':len(sig['mldsa65'])+len(sig['ed25519'])},indent=2))
