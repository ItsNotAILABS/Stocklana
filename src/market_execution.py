import importlib.util,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/'src'/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
market=load('market_exec_store','market-store.py');finance=load('market_exec_finance','finance-store.py');acct=load('market_exec_accounting','accounting_tokens.py')
FEE_ACCOUNT='stocklana:fees'
def escrow_account(mid):return f'stocklana:market:{mid}:escrow'
def vault_trade(user,mid,side,stake,payment_mode='vault',chain_signature=None,chain_slot=None):
 q=market.quote_market(mid,side,stake);esc=escrow_account(mid)
 finance.transfer(user,esc,q['collateral'],'USDC',f'market collateral {mid}')
 if q['fee']>0:finance.transfer(user,FEE_ACCOUNT,q['fee'],'USDC',f'market fee {mid}')
 try:
  out=market.trade(mid,{'side':side,'shares':stake,'trader':user,'paymentMode':payment_mode,'chainSignature':chain_signature,'chainSlot':chain_slot})
 except Exception:
  finance.transfer(esc,user,q['collateral'],'USDC','trade rollback')
  if q['fee']>0:finance.transfer(FEE_ACCOUNT,user,q['fee'],'USDC','fee rollback')
  raise

 try:
  acct.digest({'type':'MARKET_LOCK','user':user,'marketId':mid,'amount':q['collateral'],'side':side,'units':stake})
  if q['fee']>0: acct.digest({'type':'FEE_PAYMENT','user':user,'amount':q['fee'],'marketId':mid})
  acct.digest({'type':'POSITION_MINT','marketId':mid,'side':side,'holder':user,'units':stake})
  out['accounting']=acct.invariants()
 except Exception as e:
  out['accountingWarning']=str(e)
 out['quote']=q;out['escrowAccount']=esc;out['feeAccount']=FEE_ACCOUNT;return out
def redeem(user,mid):
 out=market.redeem(mid,user)
 if out['payout']>0:
  out['vault']=finance.transfer(escrow_account(mid),user,out['payout'],'USDC',f'market redemption {mid}')
  try: acct.digest({'type':'MARKET_PAYOUT','user':user,'marketId':mid,'amount':out['payout']})
  except Exception as e: out['accountingWarning']=str(e)
 try:
  pos=out.get('position') or {}; yes=float(pos.get('yes',0)); no=float(pos.get('no',0))
  if yes>0: acct.digest({'type':'POSITION_BURN','marketId':mid,'side':'YES','holder':user,'units':yes})
  if no>0: acct.digest({'type':'POSITION_BURN','marketId':mid,'side':'NO','holder':user,'units':no})
 except Exception as e: out['positionAccountingWarning']=str(e)
 return out
def transfer_position(user,recipient,mid,side,shares):
 out=market.transfer_position(mid,user,recipient,side,shares);out['receipt']=finance.record_position_transfer(user,recipient,mid,side,shares)['receipt']
 try: acct.digest({'type':'POSITION_TRANSFER','marketId':mid,'side':side,'sender':user,'recipient':recipient,'units':shares})
 except Exception as e: out['accountingWarning']=str(e)
 return out
def solvency(mid):
 ms=[m for m in market.list_markets() if m['id']==mid]
 if not ms:raise ValueError('market_not_found')
 m=ms[0];esc=float(finance.account(escrow_account(mid))['balances'].get('USDC',0));coll=float(m.get('collateral',0));paid=float(m.get('paidOut',0));required=max(0.0,coll-paid);return {'marketId':mid,'escrowUSDC':esc,'marketCollateralUSDC':coll,'paidOutUSDC':paid,'outstandingLiabilityUSDC':required,'delta':esc-required,'solvent':esc+1e-9>=required,'houseDirectionalExposure':0.0}
