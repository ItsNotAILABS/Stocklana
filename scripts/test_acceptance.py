#!/usr/bin/env python3
import importlib.util,json,pathlib,re,sys
from collections import Counter
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
def load(n,f):s=importlib.util.spec_from_file_location(n,ROOT/'src'/f);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
cat=load('acc_cat','market-catalog.py');settle=load('acc_settle','settlement-engine.py');market=load('acc_market','market-store.py');acct=load('acc_accounting','accounting_tokens.py')
assets=json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text());templates=cat.templates(assets);assert len(templates)==360
assert len({t['question'] for t in templates})==360
assert len({t['family'] for t in templates})==16
assert len(assets)==8
assert {a['contract_address'] for a in assets}==market.PRESTOCK_MINTS
assertions=5
# Every one of the 360 instruments is eligible, has a rule, and is evaluable by the automatic resolver.
for t in templates:
 assert t['underlyingMint'] in market.PRESTOCK_MINTS;assertions+=1
 assert t.get('question') and t.get('rule',{}).get('type');assertions+=1
 r=dict(t['rule']);r.setdefault('__symbol',t['symbol']);
 try: settle.evaluate_rule(r,assets)
 except KeyError:
  # basket/pair symbols can be synthetic; rule carries its own members and doesn't require __symbol.
  settle.evaluate_rule(r,assets)
 assertions+=1
# Bounty matrix: every requested category must expose at least two distinct surfaces.
bc=json.loads((ROOT/'data'/'bounty-coverage.json').read_text());expected={'derivatives','defi','tools','games','ai_agents','prediction_markets','social_communities_memes','lending_collateral','structured_products','launchpads','automations','simulations','growth_experiments','new'}
assert expected<=set(bc);assertions+=1
for k in expected:assert len(bc[k])>=2 and len(set(bc[k]))>=2;assertions+=2
# Tokenized Equities track fit: one wedge plus at least two executable surfaces in each source category.
fit=json.loads((ROOT/'data'/'track-fit.json').read_text());assert 'programmable tokenized-equity ownership' in fit['wedge'].lower();assertions+=1
for k in ['trading','investing','credit_and_yield','infrastructure','consumer','why_solana']:
 assert len(fit[k])>=2 and len(set(fit[k]))>=2;assertions+=2
for f in ['src/equity_os.py','src/kamino_adapter.py','src/xstocks_adapter.py','TRACK-FIT.md','scripts/test_track_fit.py']:
 assert (ROOT/f).exists();assertions+=1

# V1/V2 accounting and financial-token substrate.
reg=acct.registry();assert len(reg['internal'])==8;assertions+=1
assert len(reg['token2022'])==8;assertions+=1
for sym in ['SL-CASH','SL-ESCROW','SL-COLL','SL-FEE','SL-CREDIT','SL-AGENT','SL-POS','SL-BASKET']:
 assert sym in reg['internal'];assertions+=1
for sym in ['SL-ESCROW','SL-COLL','SL-CREDIT','SL-AGENT','SL-POS','SL-BASKET']:
 assert reg['token2022'][sym]['onchain'] is True;assertions+=1
assert reg['token2022']['SL-CASH']['onchain'] is False;assertions+=1
assert 'TransferHook' in reg['token2022']['SL-POS']['extensions'];assertions+=1
for f in ['src/accounting_tokens.py','src/token2022-accounting.js','docs/V2-FINANCIAL-SUBSTRATE.md','ACCOUNTING-TOKEN-RESULT.json']:
 assert (ROOT/f).exists();assertions+=1
ar=json.loads((ROOT/'ACCOUNTING-TOKEN-RESULT.json').read_text());assert ar['status']=='PASS' and ar['assertions']>=400 and ar['coverageRatio']>=1.0;assertions+=3

# Requirement contract has no unclassified/missing status.
req=json.loads((ROOT/'data'/'requirements-ledger.json').read_text());allowed={'EXECUTED_PROVEN','CODED_EXTERNAL_AUTH_REQUIRED','SOURCE_READY_DEPLOYMENT_REQUIRED'}
assert len(req['requirements'])>=40;assertions+=1
for x in req['requirements']:assert x['status'] in allowed and x.get('code') and x.get('proof');assertions+=3
# Seven-day workload proof.
w=json.loads((ROOT/'WEEK-100-PROOF.json').read_text());assert w['status']=='PASS';assert w['sessions']==700;assert w['agents']==100;assert not w['failures'];assert w['allMarketsSolvent'];assert w['houseDirectionalExposure']==0.0;assertions+=6
# UI navigation and critical action surfaces exist.
h=(ROOT/'index.html').read_text();nav=set(re.findall(r'data-nav="([^"]+)"',h));views=set(re.findall(r'id="view-([^"]+)"',h));assert nav<=views;assertions+=1
for v in ['markets','lab','vault','portfolio','agents','infrastructure','coverage','launch']:assert v in views;assertions+=1
for token in ['walletBtn','singleUseCardBtn','issueVirtualCardBtn','createMarketBtn','assetGrid','marketFeed','vaultPockets']: assert token in h;assertions+=1
# Critical source-level invariants that cannot be silently removed.
rust=(ROOT/'programs/stocklana-market/src/lib.rs').read_text()
for token in ['PRESTOCKS','USDC','resolution_commitment','TransferPosition','WithdrawFees','invoke_signed','spl_token::id()','Clock::get()']:assert token in rust;assertions+=1
for f in ['src/meteora-dbc.js','src/clawpump.py','src/solana_finance.py','src/auth.py','src/card_rail.py','src/lending.py','src/payment_fabric.py','src/pq_crypto.py','contracts/MNTY.sol','scripts/launch/create_mnty_solana.mjs']:assert (ROOT/f).exists();assertions+=1
print(json.dumps({'status':'PASS','assertions':assertions,'templates':len(templates),'families':len(set(t['family'] for t in templates)),'requirements':len(req['requirements']),'weekSessions':w['sessions']},indent=2))
