#!/usr/bin/env python3
import importlib.util, json, pathlib, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]

def load(name,path):
    s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

money=load('money_router_test','src/money_router.py')
catalog=load('market_catalog_test','src/market-catalog.py')
sim=load('sim_test','src/simulations.py')
agent=load('agent_vault_test','src/agent_vault.py')
assets=json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text())
checks=0

def ok(v,msg):
    global checks
    assert v,msg;checks+=1

p=money.purchase_plan(100,120,0,0,[])
ok(p['defaultRoute']=='WALLET_USDC','wallet direct route')
ok(p['routes'][0]['transformations']==0,'direct route must be zero-transform')

p=money.purchase_plan(100,40,70,0,[])
split=next(x for x in p['routes'] if x['id']=='SPLIT_USDC')
ok(abs(split['walletUSDC']-30)<1e-9,'split wallet amount')
ok(abs(split['vaultUSDC']-70)<1e-9,'split vault amount')

holding={'symbol':'OPENAI','mint':assets[5]['contract_address'],'amount':1,'tokenPrice':1000,'estimatedValueUSDC':1000}
p=money.purchase_plan(100,0,0,0,[holding])
pr=next(x for x in p['routes'] if x['id']=='PRESTOCK_TO_USDC')
ok(pr['canCoverEstimate'] is True,'prestock coverage')
ok(pr['ready'] is False,'investment sale must never be auto-ready')
ok('never auto-sell an investment' in p['principles'],'no-auto-sale invariant')

templates=catalog.templates(assets)
families={x['family'] for x in templates}
for f in ('gain_game','downside_shield','margin_duel','green_majority','leader','price_zone'):
    ok(f in families,f'missing game family {f}')
g=sim.parimutuel_payoff(25,40,'YES',10,100)
ok(g['maxLoss']==10.1,'bounded max loss')
ok(g['payoutIfCorrect']<=g['poolAfter']['YES']+g['poolAfter']['NO']+1e-9,'payoff exceeds collateral')

with tempfile.TemporaryDirectory() as td:
    agent.DB=pathlib.Path(td)/'agents.json'
    v=agent.create_agent_vault('buyer','owner','Buyer')
    ok(v['policy']['allowExternalCommerce'] is False,'agent commerce must default off')
    v=agent.update_commerce_policy('buyer','owner',300,100,75,['bestbuy.com','amazon.com'],False,True)
    ok(v['policy']['allowedMerchants']==['amazon.com','bestbuy.com'],'merchant allowlist normalized')
    a=agent.authorize_commerce('buyer','owner','bestbuy.com',50,False,False)
    ok(a['authorized'] is True,'in-policy purchase should authorize')
    a=agent.authorize_commerce('buyer','owner','bestbuy.com',80,False,False)
    ok(a['requiresHumanApproval'] is True,'approval threshold not enforced')
    try:
        agent.authorize_commerce('buyer','owner','evil.example',10,False,False)
        raise AssertionError('unapproved merchant accepted')
    except ValueError as e: ok(str(e)=='merchant_not_allowed','merchant allowlist error')
    try:
        agent.authorize_commerce('buyer','owner','bestbuy.com',10,True,False)
        raise AssertionError('subscription accepted')
    except ValueError as e: ok(str(e)=='agent_subscriptions_blocked','subscription block error')
    agent.record_commerce('buyer','owner','intent1','bestbuy.com',60)
    ok(agent.daily_commerce_spend('buyer')==60,'daily spend accounting')

print(f'PASS money+play+agent {checks} assertions')
