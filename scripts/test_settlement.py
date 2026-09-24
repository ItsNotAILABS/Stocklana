#!/usr/bin/env python3
import importlib.util, json, pathlib, sys, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
def load(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'src'/file); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
se=load('se_test','settlement-engine.py')
assets=json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text())
by={a['symbol']:a for a in assets}
cases=[]
# one case per supported rule family
cases.append(({'type':'valuation_threshold','operator':'gte','target':by['OPENAI']['impliedValuation']*0.9,'metric':'impliedValuation','__symbol':'OPENAI'},True))
cases.append(({'type':'price_threshold','operator':'lte','target':by['SPACEX']['tokenPrice']*1.1,'metric':'tokenPrice','__symbol':'SPACEX'},True))
cases.append(({'type':'premium_band','absMaxPct':100,'__symbol':'NEURALINK'},True))
cases.append(({'type':'premium_sign','operator':'gte','targetPct':-100,'__symbol':'KALSHI'},True))
cases.append(({'type':'absolute_return','absMinPct':0,'launchPrice':by['ANDURIL']['tokenPrice'],'__symbol':'ANDURIL'},True))
cases.append(({'type':'relative_return','left':'OPENAI','right':'ANTHROPIC','leftLaunchPrice':by['OPENAI']['tokenPrice']*0.9,'rightLaunchPrice':by['ANTHROPIC']['tokenPrice']},True))
cases.append(({'type':'valuation_ratio','left':'OPENAI','right':'ANTHROPIC','launchRatio':0.1},True))
cases.append(({'type':'joint_positive','members':['OPENAI','SPACEX'],'launchPrices':{'OPENAI':by['OPENAI']['tokenPrice']*0.9,'SPACEX':by['SPACEX']['tokenPrice']*0.9}},True))
cases.append(({'type':'basket_return_threshold','members':['OPENAI','SPACEX'],'weights':[0.5,0.5],'thresholdPct':-1,'launchPrices':{'OPENAI':by['OPENAI']['tokenPrice'],'SPACEX':by['SPACEX']['tokenPrice']}},True))
cases.append(({'type':'basket_leader','members':['OPENAI','SPACEX'],'candidate':'OPENAI','launchPrices':{'OPENAI':by['OPENAI']['tokenPrice']*0.5,'SPACEX':by['SPACEX']['tokenPrice']}},True))
cases.append(({'type':'price_zone','low':by['OPENAI']['tokenPrice']*0.9,'high':by['OPENAI']['tokenPrice']*1.1,'metric':'tokenPrice','__symbol':'OPENAI'},True))
cases.append(({'type':'valuation_zone','low':by['ANTHROPIC']['impliedValuation']*0.9,'high':by['ANTHROPIC']['impliedValuation']*1.1,'metric':'impliedValuation','__symbol':'ANTHROPIC'},True))
cases.append(({'type':'return_threshold','operator':'gte','thresholdPct':-1,'launchPrice':by['FIGUREAI']['tokenPrice'],'__symbol':'FIGUREAI'},True))
cases.append(({'type':'relative_margin','left':'OPENAI','right':'ANTHROPIC','marginPct':-100,'leftLaunchPrice':by['OPENAI']['tokenPrice'],'rightLaunchPrice':by['ANTHROPIC']['tokenPrice']},True))
cases.append(({'type':'green_count','members':['OPENAI','SPACEX'],'minimum':1,'launchPrices':{'OPENAI':by['OPENAI']['tokenPrice']*0.9,'SPACEX':by['SPACEX']['tokenPrice']}},True))
for rule,expected in cases:
 got,_=se.evaluate_rule(rule,assets)
 assert got is expected,(rule,got)
assert se.is_due({'resolveAt':'2020-01-01T00:00:00Z'})
assert not se.is_due({'resolveAt':'2030-01-01T00:00:00Z'})
print('PASS automatic settlement evaluator:',len(cases),'rule families')
