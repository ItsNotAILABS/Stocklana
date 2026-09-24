#!/usr/bin/env python3
import importlib.util,pathlib,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]

def load(name,path):
    s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

ch=load('challenge_test','src/challenges.py')
ms=load('market_store_challenge_test','src/market-store.py')
checks=0
def ok(v,msg):
    global checks
    assert v,msg;checks+=1

source={
 'id':'seed_test','underlyingMint':'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',
 'symbol':'OPENAI','question':'Will OPENAI gain 15%?','rule':{'type':'return_threshold','thresholdPct':15},
 'family':'gain_game','label':'Gain Game','resolveAt':'2027-06-30','feeBps':100,'status':'OPEN'
}
with tempfile.TemporaryDirectory() as td:
    td=pathlib.Path(td);ch.DB=td/'challenges.json';ms.DB=td/'markets.json'
    prep=ch.create('creator',source,'YES',25,3600)
    ok(prep['challenge']['status']=='WAITING','new challenge state')
    market=ms.create_market(prep['market'])
    t=ms.trade(market['id'],{'side':'YES','shares':25,'trader':'creator'})
    ch.mark_creator_funded(prep['challenge']['id'],'creator',t['trade'])
    ok(ch.get(prep['challenge']['id'])['status']=='OPEN_FOR_OPPONENT','creator funding state')
    claim=ch.begin_accept(prep['challenge']['id'],'opponent-a')
    ok(claim['challenge']['status']=='ACCEPTING','atomic accepting state')
    try:
        ch.begin_accept(prep['challenge']['id'],'opponent-b')
        raise AssertionError('second opponent claimed same invite')
    except ValueError as e: ok(str(e)=='challenge_not_open','double claim blocked')
    ch.fail_accept(prep['challenge']['id'],'opponent-a',claim['nonce'],'simulated_failure')
    ok(ch.get(prep['challenge']['id'])['status']=='OPEN_FOR_OPPONENT','failed claim reopened')
    claim=ch.begin_accept(prep['challenge']['id'],'opponent-b')
    t2=ms.trade(market['id'],{'side':'NO','shares':25,'trader':'opponent-b'})
    final=ch.finish_accept(prep['challenge']['id'],'opponent-b',claim['nonce'],t2['trade'])
    ok(final['status']=='MATCHED','challenge matched')
    ok(final['opponent']=='opponent-b','opponent recorded')
    m=[x for x in ms.list_markets() if x['id']==market['id']][0]
    ok(abs(m['collateral']-50)<1e-9,'two-sided collateral')
    ok(abs(m['yesPool']-25)<1e-9 and abs(m['noPool']-25)<1e-9,'equal duel pools')

with tempfile.TemporaryDirectory() as td:
    td=pathlib.Path(td);ch.DB=td/'challenges.json';ms.DB=td/'markets.json'
    prep=ch.create('creator',source,'NO',10,3600);market=ms.create_market(prep['market'])
    t=ms.trade(market['id'],{'side':'NO','shares':10,'trader':'creator'});ch.mark_creator_funded(prep['challenge']['id'],'creator',t['trade'])
    q=ms.unmatched_refund_quote(market['id'],'creator')
    ok(abs(q['collateralUSDC']-10)<1e-9,'refund collateral quote')
    cancelled=ms.cancel_unmatched(market['id'],'creator')
    ok(cancelled['market']['status']=='CANCELLED','unmatched market cancelled')
    ok(cancelled['market']['collateral']==0,'cancel clears liability')

print(f'PASS challenges {checks} assertions')
