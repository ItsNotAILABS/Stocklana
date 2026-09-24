import sys, os, json, base64, time
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
import agent_vault, payment_fabric, pq_crypto
# Isolated proof state
for f in [ROOT/'data'/'agent-vaults.json', ROOT/'data'/'payment-fabric.json']:
    if f.exists(): f.unlink()
vaults=agent_vault.seed_agent_vaults(100)
assert len(vaults)==100
assert len({v['vaultId'] for v in vaults})==100
assert all(v['crypto']['suite']=='Stocklana-Phantasma-PQ-v2' for v in vaults)
assert all(pq_crypto.hybrid_verify({'event':'agent_vault_created','vaultId':v['vaultId'],'agentId':v['agentId'],'owner':v['owner'],'at':v['createdAt']},v['provisioningProof']) for v in vaults)
# 100 human handles + 100 independently signed offline payment intents
for i in range(100):
    user=f'user-{i:03d}'; payment_fabric.register_handle(user,f'u{i:03d}')
    sk=Ed25519PrivateKey.generate(); raw=sk.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw)
    did=f'device-{i:03d}'; payment_fabric.register_device(user,did,base64.b64encode(raw).decode())
    now=int(time.time()); intent={'v':1,'type':'MAQUE_OFFLINE_PAYMENT','payer':user,'payee':'merchant-001','asset':'USDC','amount':1.0+i/100,'nonce':f'nonce-{i:03d}-{os.urandom(8).hex()}','issuedAt':now,'expiresAt':now+300,'deviceId':did}
    sig=base64.b64encode(sk.sign(payment_fabric.canonical(intent))).decode()
    rec=payment_fabric.accept_offline_intent(intent,sig)
    assert rec['status']=='VERIFIED_PENDING_SETTLEMENT'
    try: payment_fabric.accept_offline_intent(intent,sig); raise AssertionError('replay accepted')
    except ValueError as e: assert str(e)=='replay_detected'
print(json.dumps({'agentVaults':100,'uniqueVaults':100,'pqProvisioningProofsVerified':100,'handles':100,'offlinePaymentIntentsVerified':100,'replaysRejected':100,'assertionGroups':6,'status':'PASS'},indent=2))
