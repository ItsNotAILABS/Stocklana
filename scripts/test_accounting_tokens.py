#!/usr/bin/env python3
import importlib.util, pathlib, random, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
P=ROOT/'src'/'accounting_tokens.py'
spec=importlib.util.spec_from_file_location('acct',P); acct=importlib.util.module_from_spec(spec); spec.loader.exec_module(acct)
checks=0
def ok(x,msg='assertion'):
    global checks
    checks+=1
    if not x: raise AssertionError(msg)

acct.reset_for_test()
r=acct.registry()
ok(len(r['internal'])==8,'8 V2 internal token classes')
ok(len(r['token2022'])==8,'8 v2 mappings')
ok(r['token2022']['SL-CASH']['onchain'] is False)
ok('TransferHook' in r['token2022']['SL-POS']['extensions'])
ok('NonTransferable' in r['token2022']['SL-COLL']['extensions'])

# 100 independent users: every external USDC deposit must mint exactly matched SL-CASH.
for i in range(100):
    u=f'user-{i:03d}'; amt=10+i/10
    out=acct.digest({'type':'DEPOSIT_USDC','user':u,'amount':amt,'reference':f'dep-{i}'})
    ok(out['invariants']['fullyBackedMonetaryClaims'],f'backed deposit {i}')
    ok(out['invariants']['journalBalanced'],f'balanced deposit {i}')

snap=acct.snapshot(); inv=snap['invariants']
ok(abs(inv['externalUSDC']-sum(10+i/10 for i in range(100)))<1e-4,'external deposit total')
ok(abs(inv['externalUSDC']-inv['monetaryClaimsUSDC'])<1e-4,'cash exactly backed')

# Market accounting: cash -> escrow -> fee + payout, no minting money.
acct.digest({'type':'MARKET_LOCK','user':'user-000','marketId':'m1','amount':5})
acct.digest({'type':'MARKET_LOCK','user':'user-001','marketId':'m1','amount':5})
# Normalize per-user escrow into the pool via explicit accounting test helper events not needed;
# fees are captured from one holder, payout from the other.
acct.digest({'type':'FEE_CAPTURE','marketId':'m1','amount':0.5})
acct.digest({'type':'MARKET_PAYOUT','user':'user-001','marketId':'m1','amount':4.5})
acct.digest({'type':'MARKET_PAYOUT','user':'user-001','marketId':'m1','amount':5.0})
inv=acct.snapshot()['invariants']; ok(inv['fullyBackedMonetaryClaims'],'market claims backed'); ok(inv['journalBalanced'],'market journal balanced')

# Collateral cannot duplicate cash.
acct.digest({'type':'COLLATERAL_LOCK','user':'user-002','collateralId':'c1','amount':3})
inv=acct.snapshot()['invariants']; ok(inv['fullyBackedMonetaryClaims']);
acct.digest({'type':'COLLATERAL_UNLOCK','user':'user-002','collateralId':'c1','amount':3})
ok(acct.snapshot()['invariants']['fullyBackedMonetaryClaims'])

# Funded credit: transfer existing pool cash, never create cash claims out of thin air.
acct.seed_lender_pool(1000)
before=acct.snapshot()['invariants']['monetaryClaimsUSDC']
for i in range(25):
    u=f'user-{i:03d}'; loan=f'loan-{i:03d}'
    acct.digest({'type':'CREDIT_DRAW','user':u,'loanId':loan,'amount':10,'pool':'LENDER_POOL'})
    ok(acct.snapshot()['invariants']['fullyBackedMonetaryClaims'],f'credit backed {i}')
after=acct.snapshot()['invariants']['monetaryClaimsUSDC']
ok(abs(before-after)<1e-6,'funded credit does not create new cash claims')
for i in range(25):
    acct.digest({'type':'CREDIT_REPAY','user':f'user-{i:03d}','loanId':f'loan-{i:03d}','amount':10,'pool':'LENDER_POOL'})
    ok(acct.snapshot()['invariants']['fullyBackedMonetaryClaims'])

# Agent budget is a capability, not money; changing it must not change monetary claims.
before=acct.snapshot()['invariants']['monetaryClaimsUSDC']
for i in range(100):
    acct.digest({'type':'AGENT_BUDGET_SET','agentId':f'agent-{i:03d}','amount':100+i})
    ok(acct.snapshot()['invariants']['journalBalanced'])
after=acct.snapshot()['invariants']['monetaryClaimsUSDC']; ok(abs(before-after)<1e-6,'agent budget is non-monetary')

# Agent/human digest keeps money, capabilities, positions and collateral distinct.
d=acct.financial_digest('agent-000');ok(d['schema']=='StocklanaFinancialDigest/v2');ok(d['capabilities']['agentBudgetLimitUSDC']==100.0);ok(d['capabilities']['isMoney'] is False);ok('availableUSDC' in d['monetary']);ok('actionHints' in d)
# External event idempotency: a chain signature can never mint cash receipts twice.
first=acct.digest({'type':'DEPOSIT_USDC','user':'idempotent-user','amount':7,'eventId':'sig-unique-001'});second=acct.digest({'type':'DEPOSIT_USDC','user':'idempotent-user','amount':7,'eventId':'sig-unique-001'});ok(not first.get('duplicate'));ok(second.get('duplicate') is True);ok(abs(acct.financial_digest('idempotent-user')['monetary']['availableUSDC']-7.0)<1e-9)

# Positions transfer without changing money supply.
for i in range(50):
    m=f'm-{i:03d}'; a=f'user-{i:03d}'; b=f'user-{(i+1)%100:03d}'
    acct.digest({'type':'POSITION_MINT','marketId':m,'side':'YES','holder':a,'units':10})
    acct.digest({'type':'POSITION_TRANSFER','marketId':m,'side':'YES','sender':a,'recipient':b,'units':4})
    ok(acct.snapshot()['invariants']['journalBalanced'])
    acct.digest({'type':'POSITION_BURN','marketId':m,'side':'YES','holder':a,'units':6})
    acct.digest({'type':'POSITION_BURN','marketId':m,'side':'YES','holder':b,'units':4})
    ok(acct.snapshot()['invariants']['journalBalanced'])

# Basket receipts are typed claims, not cash.
for i in range(20):
    acct.digest({'type':'BASKET_ISSUE','basketId':f'basket-{i}','holder':'user-050','units':3})
    acct.digest({'type':'BASKET_REDEEM','basketId':f'basket-{i}','holder':'user-050','units':3})
    ok(acct.snapshot()['invariants']['journalBalanced'])

# Final system invariants.
final=acct.snapshot()['invariants']
ok(final['fullyBackedMonetaryClaims'],'final backing')
ok(final['journalBalanced'],'final journal')
ok(final['cashCoverageRatio'] is not None and final['cashCoverageRatio'] >= 1.0,'coverage >= 1')
result={'status':'PASS','assertions':checks,'internalTokenClasses':len(r['internal']),'token2022Mappings':len(r['token2022']),'coverageRatio':final['cashCoverageRatio'],'receiptHead':final['receiptHead'],'operations':{'externalDeposits':101,'agentBudgetAssignments':100,'fundedCreditDraws':25,'fundedCreditRepayments':25,'positionLifecycles':50,'basketLifecycles':20,'idempotencyReplayChecks':1},'invariants':['balanced_double_entry','monetary_claims_fully_backed','funded_credit_no_cash_creation','agent_budget_not_money','position_transfer_conservation','basket_receipt_conservation','external_event_idempotency']}
(ROOT/'ACCOUNTING-TOKEN-RESULT.json').write_text(__import__('json').dumps(result,indent=2))
print(f'PASS accounting-token-v2 assertions={checks} receipt={final["receiptHead"][:24]}')
acct.reset_for_test()
