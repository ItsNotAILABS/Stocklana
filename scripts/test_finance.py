#!/usr/bin/env python3
import importlib.util, json, pathlib, tempfile, shutil, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/'src'/path); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
finance=load('finance','finance-store.py'); market=load('market','market-store.py'); catalog=load('catalog','market-catalog.py'); execution=load('execution','market_execution.py'); pq=load('pq','pq_crypto.py')
# isolate DB files by backup/restore
fdb=ROOT/'data'/'finance.json'; mdb=ROOT/'data'/'markets.json'; backups={}
for p in (fdb,mdb):
    if p.exists(): backups[p]=p.read_bytes(); p.unlink()
try:
    assets=json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text(encoding='utf-8'))
    ts=catalog.templates(assets)
    assert len(ts)==360
    assert len({x['question'] for x in ts})==len(ts)
    families={x['family'] for x in ts}
    for fam in ['valuation','premium','discount','price','move','relative','spread','joint','basket','leader','price_zone','value_zone','gain_game','downside_shield','margin_duel','green_majority']: assert fam in families
    finance.credit('alice',1000,'USDC','test','seed')
    assert finance.account('alice')['balances']['USDC']==1000
    assert finance.account('alice')['subaccounts']['CASH']['USDC']==1000
    finance.move_subaccount('alice',100,'CASH','TRADING','USDC')
    aa=finance.account('alice'); assert aa['subaccounts']['TRADING']['USDC']==100 and aa['subaccounts']['CASH']['USDC']==900
    finance.move_subaccount('alice',100,'TRADING','CASH','USDC')
    finance.transfer('alice','bob',125,'USDC','hello')
    assert finance.account('alice')['balances']['USDC']==875
    assert finance.account('bob')['balances']['USDC']==125
    r=finance.receipts(10); assert len(r['receipts'])>=2; assert len(r['head'])==128; assert r['receipts'][0]['proofSuite'].startswith('BLAKE2b-512'); assert r['receipts'][0]['privatePayloadEncrypted']
    # 100 invariants over repeated exact-value internal transfers.
    for i in range(100):
        finance.transfer('alice','bob',1,'USDC',f't{i}')
        assert abs(finance.account('alice')['balances']['USDC']-(874-i))<1e-9
    r=finance.receipts(200); assert len(r['pqAnchors'])>=1; a=r['pqAnchors'][0]; assert pq.hybrid_verify({k:v for k,v in a.items() if k!='signature'},a['signature'])
    finance.credit('alice',100,'USDC','topup')
    t=ts[0]
    m=market.create_market({**t,'id':'finance_test_market','resolveAt':'2027-06-30','liquidity':500})
    q=market.quote_market(m['id'],'YES',10); assert q['total']>0
    tr=execution.vault_trade('alice',m['id'],'YES',10,'vault')
    assert tr['position']['yes']==10
    pt=market.transfer_position(m['id'],'alice','bob','YES',3)
    assert pt['senderPosition']['yes']==7 and pt['recipientPosition']['yes']==3
    finance.record_position_transfer('alice','bob',m['id'],'YES',3)
    market.resolve(m['id'],{'outcome':'YES','proof':{'source':'test'}})
    payout=execution.redeem('bob',m['id'])['payout']; assert payout==3
    assert finance.account('bob')['balances']['USDC']==228
    assert execution.solvency(m['id'])['solvent']
    print(f'PASS finance+catalog: {len(ts)} market templates, 100 transfer invariants, vault/position/receipt lifecycle')
finally:
    for p in (fdb,mdb):
        if p.exists(): p.unlink()
        if p in backups: p.write_bytes(backups[p])
