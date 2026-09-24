#!/usr/bin/env python3
import importlib.util, pathlib, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]

def load(name,path):
    s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

commerce=load('commerce_lifecycle_test','src/commerce.py')
card=load('card_lifecycle_test','src/card_rail.py')
agent=load('agent_lifecycle_test','src/agent_vault.py')
checks=0

def ok(v,msg):
    global checks
    assert v,msg;checks+=1

with tempfile.TemporaryDirectory() as td:
    td=pathlib.Path(td)
    commerce.DB=td/'commerce.json'; card.DB=td/'cards.json'
    fin=card.finance_store; fin.DB=td/'finance.json'; fin.JOURNAL_KEY_ENVELOPE=td/'journal-key.json'; fin._JOURNAL_DEK=None
    fin.credit('owner',100,'USDC','test','seed')

    i=commerce.create_intent('owner','https://shop.example/item',50,'STOCKLANA_USDC')
    p=card.create_policy('owner',50,'shop.example',None,900)
    commerce.mark_funded('owner',i['id'],'vault')
    attached=commerce.attach_card('owner',i['id'],p,{'ready':False,'reason':'issuer_credentials_not_configured'})
    ok(attached['intent']['status']=='POLICY_RESERVED_PROVIDER_REQUIRED','reserved state')
    ok(abs(fin.account('owner')['balances']['USDC']-50)<1e-9,'reserve reduced spendable')
    pc=card.cancel('owner',p['id']);cc=commerce.mark_cancelled('owner',i['id'],pc)
    ok(cc['status']=='CANCELLED','cancelled commerce')
    ok(abs(fin.account('owner')['balances']['USDC']-100)<1e-9,'cancel released funds')
    ok(card.cancel('owner',p['id']).get('duplicate') is True,'cancel idempotent')

    i2=commerce.create_intent('owner','https://shop.example/item2',50,'STOCKLANA_USDC')
    p2=card.create_policy('owner',50,'shop.example',None,900)
    commerce.mark_funded('owner',i2['id'],'vault')
    commerce.attach_card('owner',i2['id'],p2,{'ready':True,'providerStatus':'CREATED'})
    cap=card.capture('owner',p2['id'],30,'provider-event-1')
    done=commerce.mark_captured('owner',i2['id'],cap,'evt1')
    ok(done['status']=='PURCHASED' and done['capturedUSDC']==30,'capture state')
    ok(abs(fin.account('owner')['balances']['USDC']-70)<1e-9,'uncaptured remainder released')
    ok(card.capture('owner',p2['id'],30,'provider-event-1').get('duplicate') is True,'capture idempotent')
    ok(commerce.mark_captured('owner',i2['id'],cap,'evt1').get('duplicate') is True,'commerce capture idempotent')
    try:
        card.capture('owner',p2['id'],31,'provider-event-2')
        raise AssertionError('different capture accepted')
    except ValueError as e:
        ok(str(e)=='card_policy_already_captured','capture mutation blocked')

with tempfile.TemporaryDirectory() as td:
    agent.DB=pathlib.Path(td)/'agents.json'
    agent.create_agent_vault('buyer','owner','Buyer')
    agent.update_commerce_policy('buyer','owner',100,100,100,['shop.example'],False,True)
    agent.reserve_commerce('buyer','owner','intent-a','shop.example',80,True)
    ok(agent.commerce_usage('buyer')['pendingUSDC']==80,'pending exposure')
    try:
        agent.reserve_commerce('buyer','owner','intent-b','shop.example',30,True)
        raise AssertionError('daily pending overcommit accepted')
    except ValueError as e:
        ok(str(e)=='agent_daily_spend_limit_exceeded','pending daily limit')
    agent.release_commerce('buyer','owner','intent-a','cancel')
    ok(agent.commerce_usage('buyer')['pendingUSDC']==0,'reservation release')
    agent.reserve_commerce('buyer','owner','intent-b','shop.example',30,True)
    agent.record_commerce('buyer','owner','intent-b','shop.example',30)
    u=agent.commerce_usage('buyer')
    ok(u['spentUSDC']==30 and u['pendingUSDC']==0,'capture moves pending to spent')

print(f'PASS commerce lifecycle {checks} assertions')
