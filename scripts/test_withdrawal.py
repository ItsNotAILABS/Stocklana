#!/usr/bin/env python3
import importlib.util, pathlib, sys, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
sp=importlib.util.spec_from_file_location('fs_wd',ROOT/'src'/'finance-store.py'); fs=importlib.util.module_from_spec(sp); sp.loader.exec_module(fs)
u='wdtest_'+uuid.uuid4().hex[:8]
fs.credit(u,100,'USDC','test')
a=fs.request_withdrawal(u,25,'DestinationWallet111111111111111111111111111')
assert a['withdrawal']['status']=='RESERVED'; assert fs.account(u)['balances']['USDC']>=75
assert a['withdrawal']['authorization']['suite']=='ML-DSA-65+Ed25519'
b=fs.cancel_withdrawal(u,a['withdrawal']['id']); assert b['withdrawal']['status']=='CANCELLED'; assert fs.account(u)['balances']['USDC']>=100
print('PASS withdrawal reserve -> PQ authorization -> cancel')
