import math

def parimutuel_payoff(yes_pool,no_pool,side,stake,fee_bps=100):
 y=float(yes_pool)+(float(stake) if side=='YES' else 0);n=float(no_pool)+(float(stake) if side=='NO' else 0);collateral=y+n;winning=y if side=='YES' else n;fee=float(stake)*fee_bps/10000
 payout=0 if winning<=0 else float(stake)/winning*collateral
 return {'side':side,'stake':float(stake),'fee':fee,'totalCost':float(stake)+fee,'poolAfter':{'YES':y,'NO':n},'impliedYes':0.5 if collateral==0 else y/collateral,'payoutIfCorrect':payout,'profitIfCorrect':payout-float(stake)-fee,'maxLoss':float(stake)+fee}
def stress_market(yes_pool,no_pool,orders):
 y=float(yes_pool);n=float(no_pool);path=[]
 for o in orders:
  stake=float(o['stake']);side=o['side'];y+=stake if side=='YES' else 0;n+=stake if side=='NO' else 0;path.append({'side':side,'stake':stake,'yesProbability':0.5 if y+n==0 else y/(y+n),'collateral':y+n})
 return {'start':{'YES':yes_pool,'NO':no_pool},'end':{'YES':y,'NO':n},'path':path,'fullyCollateralized':True,'maxPayoutLiability':y+n}
def basket_scenario(returns,weights=None):
 vals=[float(x) for x in returns];weights=weights or [1/len(vals)]*len(vals);return {'weightedReturnPct':sum(v*w for v,w in zip(vals,weights)),'positiveMembers':sum(1 for v in vals if v>0),'members':len(vals)}
def capabilities():return {'payoffSimulator':True,'liquidityStress':True,'basketScenario':True}
