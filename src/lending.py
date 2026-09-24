import json,time,uuid,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
import importlib.util

def _loadmod(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/'src'/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
finance=_loadmod('finance_lending','finance-store.py');pq=_loadmod('pq_lending','pq_crypto.py')
DB=ROOT/'data'/'lending.json';POOL='stocklana:lending-pool';FEES='stocklana:lending-fees'
def _load():
 try:return json.loads(DB.read_text()) if DB.exists() else {'loans':{},'pool':{'account':POOL}}
 except:return {'loans':{},'pool':{'account':POOL}}
def _save(d):
 t=DB.with_suffix('.tmp');t.write_text(json.dumps(d,indent=2,sort_keys=True));t.replace(DB)
def fund_pool(provider,amount):return finance.transfer(provider,POOL,float(amount),'USDC','lend pool liquidity')
def quote(collateral,borrow,apr_bps=900,days=30):
 c=float(collateral);b=float(borrow)
 if c<=0 or b<=0:raise ValueError('invalid_amount')
 ltv=b/c
 return {'collateralUSDC':c,'borrowUSDC':b,'ltv':ltv,'maxLtv':0.50,'eligible':ltv<=.50,'aprBps':int(apr_bps),'termDays':int(days),'interestUSDC':b*(apr_bps/10000)*(days/365)}
def open_loan(user,collateral,borrow,apr_bps=900,days=30):
 q=quote(collateral,borrow,apr_bps,days)
 if not q['eligible']:raise ValueError('ltv_too_high')
 if finance.account(POOL)['balances'].get('USDC',0)+1e-9<float(borrow):raise ValueError('lending_pool_insufficient')
 lid='loan_'+uuid.uuid4().hex[:18];key='loan:'+lid;finance.lock(user,key,float(collateral),'USDC');finance.transfer(POOL,user,float(borrow),'USDC',f'loan draw {lid}')
 now=int(time.time()); due=round(float(borrow)+q['interestUSDC'],6);loan={'id':lid,'user':user,'collateralUSDC':float(collateral),'principalUSDC':float(borrow),'dueUSDC':due,'aprBps':int(apr_bps),'openedAt':now,'dueAt':now+int(days)*86400,'status':'OPEN','collateralLock':key};loan['pqProof']=pq.hybrid_sign({k:v for k,v in loan.items() if k!='pqProof'});d=_load();d['loans'][lid]=loan;_save(d);return loan
def repay(user,lid):
 d=_load();l=d['loans'].get(lid)
 if not l or l['user']!=user:raise ValueError('loan_not_found')
 if l['status']!='OPEN':raise ValueError('loan_not_open')
 principal=l['principalUSDC'];interest=l['dueUSDC']-principal;finance.transfer(user,POOL,principal,'USDC',f'loan principal {lid}')
 if interest>0:finance.transfer(user,FEES,interest,'USDC',f'loan interest {lid}')
 finance.release_locked(user,l['collateralLock'],'USDC');l['status']='REPAID';l['repaidAt']=int(time.time());_save(d);return l
def health(user,lid):
 l=_load()['loans'].get(lid)
 if not l or l['user']!=user:raise ValueError('loan_not_found')
 return {**l,'poolLiquidityUSDC':finance.account(POOL)['balances'].get('USDC',0),'collateralRatio':l['collateralUSDC']/max(l['principalUSDC'],1e-9)}
def capabilities():return {'products':['vault-collateral credit line','agent working-capital line'],'maxLtv':0.5,'poolFundedOnly':True,'interestDestination':FEES,'moneyCreation':False}
