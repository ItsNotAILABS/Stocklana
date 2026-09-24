#!/usr/bin/env python3
import importlib.util, pathlib, sys, threading, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
sp=importlib.util.spec_from_file_location('fs_conc',ROOT/'src'/'finance-store.py'); fs=importlib.util.module_from_spec(sp); sp.loader.exec_module(fs)
a='ca_'+uuid.uuid4().hex[:8]; b='cb_'+uuid.uuid4().hex[:8]
fs.credit(a,1000,'USDC','concurrency-test')
errs=[]
def move(i):
    try: fs.transfer(a,b,1,'USDC',f'parallel-{i}')
    except Exception as e: errs.append(str(e))
threads=[threading.Thread(target=move,args=(i,)) for i in range(100)]
[t.start() for t in threads]; [t.join() for t in threads]
aa=fs.account(a)['balances']['USDC']; bb=fs.account(b)['balances']['USDC']
assert not errs, errs[:3]
assert abs((aa+bb)-1000)<1e-9,(aa,bb)
assert abs(bb-100)<1e-9,(aa,bb)
print('PASS 100 concurrent transfers preserve balance conservation')
