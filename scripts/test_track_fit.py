#!/usr/bin/env python3
import importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/'src'/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
osmod=load('equity_os','equity_os.py');kamino=load('kamino','kamino_adapter.py');acct=load('accounting_tokens','accounting_tokens.py')
fit=json.loads((ROOT/'data'/'track-fit.json').read_text())
checks=0
assert 'tokenized-equity' in fit['wedge'];checks+=1
for k in ['trading','investing','credit_and_yield','infrastructure','consumer','why_solana']:
 assert len(fit[k])>=2,(k,fit[k]);checks+=1
cap=osmod.capabilities();assert cap['wedge']=='PROGRAMMABLE_TOKENIZED_EQUITY_OWNERSHIP';checks+=1
r=osmod.recurring_plan('track-test','OPENAI',25,'WEEKLY');assert r['mint'].startswith('Pre');checks+=1
b=osmod.create_basket('track-test','AI Frontier',['OPENAI','ANTHROPIC','FIGUREAI'],[.4,.35,.25]);checks+=1
orders=osmod.basket_orders(b['id'],100);assert abs(sum(x['usdcAmount'] for x in orders['orders'])-100)<1e-6;checks+=1
robo=osmod.create_robo('track-test','BALANCED',300);assert abs(sum(x['weight'] for x in robo['allocation'])-1)<1e-9;checks+=1
ca=osmod.record_corporate_action('OPENAI','DIVIDEND','2026-12-01',{'cashPerUnit':1.25});assert ca['type']=='DIVIDEND';checks+=1
kc=kamino.capabilities();assert kc['clientSignsLocally'] and 'deposit' in kc['depositTransactionBuilder'];checks+=1
reg=acct.registry();assert len(reg['internal'])==8 and len(reg['token2022'])==8;checks+=1
assert reg['token2022']['SL-POS']['onchain'] and 'TransferHook' in reg['token2022']['SL-POS']['extensions'];checks+=1
assert (ROOT/'src'/'token2022-accounting.js').exists();checks+=1
print(f'PASS tokenized-equities track fit: {checks} assertions')
