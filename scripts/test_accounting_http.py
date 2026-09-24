#!/usr/bin/env python3
import json, os, subprocess, time, urllib.request
ROOT=os.path.dirname(os.path.dirname(__file__))
env={**os.environ,'STOCKLANA_DEV_AUTH':'1','STOCKLANA_DEV_CREDIT':'1','STOCKLANA_ACCOUNTING_OPERATOR_TOKEN':'test-operator'}
p=subprocess.Popen(['python3','server.py','--port','5194'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env)
try:
 time.sleep(2)
 def req(path,method='GET',body=None,headers=None):
  data=None if body is None else json.dumps(body).encode();h={'content-type':'application/json'};h.update(headers or {})
  with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:5194'+path,data=data,method=method,headers=h),timeout=5) as r:return json.loads(r.read())
 reg=req('/api/accounting/registry');assert len(reg['internal'])==8 and len(reg['token2022'])==8
 req('/api/accounting/digest','POST',{'type':'DEPOSIT_USDC','user':'agent-http','amount':25,'eventId':'http-dep-1'},{'X-Stocklana-Accounting-Operator':'test-operator'})
 req('/api/accounting/digest','POST',{'type':'AGENT_BUDGET_SET','agentId':'agent-http','amount':100,'eventId':'http-budget-1'},{'X-Stocklana-Accounting-Operator':'test-operator'})
 me=req('/api/accounting/me?trader=agent-http');assert me['monetary']['availableUSDC']==25 and me['capabilities']['agentBudgetLimitUSDC']==100
 snap=req('/api/accounting/tokens');assert snap['invariants']['fullyBackedMonetaryClaims'] and snap['invariants']['journalBalanced']
 print('PASS accounting HTTP registry+digest+agent-state')
finally:
 p.terminate();p.wait(timeout=3)
 # leave release state clean
 import importlib.util,pathlib
 f=pathlib.Path(ROOT)/'src'/'accounting_tokens.py';s=importlib.util.spec_from_file_location('a',f);a=importlib.util.module_from_spec(s);s.loader.exec_module(a);a.reset_for_test()
