#!/usr/bin/env python3
import importlib.util, pathlib, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
sol=load('solana_finance_wc','src/solana_finance.py')
commerce=load('commerce_wc','src/commerce.py')
assets=load('market_store_wc','src/market-store.py').PRESTOCK_MINTS
checks=0
def ok(x,msg):
 global checks
 assert x,msg;checks+=1
routes=sol.wallet_routes(assets)
ok(routes['nonPreStocksPreIPO'] is False,'prestocks lane must stay strict')
ok(sol.USDC in routes['supportedMints'],'USDC missing')
ok(sol.SOL_MINT in routes['supportedMints'],'SOL missing')
ok(set(assets).issubset(set(routes['supportedMints'])),'eligible PreStocks missing')
try:
 sol.wallet_swap_order('bad','also-bad',1,'11111111111111111111111111111111',assets)
 raise AssertionError('bad mint accepted')
except ValueError as e: ok(str(e)=='swap_asset_not_supported','unexpected allowlist error')
with tempfile.TemporaryDirectory() as td:
 commerce.DB=pathlib.Path(td)/'commerce.json'
 x=commerce.create_intent('owner','https://shop.example/item',42,'WALLET_USDC',agent_id='agent-7')
 ok(x['merchantHost']=='shop.example','merchant host not bound')
 ok(x['status']=='AWAITING_FUNDS','wallet funding status')
 ok(x['allowSubscriptions'] is False,'subscriptions must default blocked')
 x=commerce.mark_funded('owner',x['id'],'sig123')
 ok(x['status']=='FUNDED','funding state')
 out=commerce.attach_card('owner',x['id'],{'id':'cardpol_1'},{'ready':False,'reason':'issuer_credentials_not_configured'})
 ok(out['intent']['status']=='POLICY_RESERVED_PROVIDER_REQUIRED','provider boundary state')
 ok(len(commerce.list_intents('owner'))==1,'history missing')
print(f'PASS wallet+commerce {checks} assertions')
