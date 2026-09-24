import json, time, uuid, threading, functools
from pathlib import Path

DATA=Path(__file__).resolve().parents[1]/'data'; DATA.mkdir(exist_ok=True); DB=DATA/'markets.json'
STATE_LOCK=threading.RLock()
PRESTOCK_MINTS={
'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB','Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw',
'PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd','PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua',
'PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S','PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',
'Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP','PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh'}

def serialized(fn):
 @functools.wraps(fn)
 def w(*a,**k):
  with STATE_LOCK:return fn(*a,**k)
 return w

def _load():
 try:
  d=json.loads(DB.read_text()) if DB.exists() else {'markets':{},'positions':{}}
  d.setdefault('markets',{}); d.setdefault('positions',{}); return d
 except:return {'markets':{},'positions':{}}
def _save(d):
 t=DB.with_suffix('.tmp'); t.write_text(json.dumps(d,indent=2,sort_keys=True)); t.replace(DB)
def _prob(m):
 y=float(m.get('yesPool',m.get('qYes',0))); n=float(m.get('noPool',m.get('qNo',0))); total=y+n
 return 0.5 if total<=1e-12 else y/total
def _family(m):
 rt=(m.get('rule') or {}).get('type')
 if m.get('family'): return m['family']
 if rt=='return_threshold': return 'gain_game' if float((m.get('rule') or {}).get('thresholdPct',0))>=0 else 'downside_shield'
 return {
  'relative_margin':'margin_duel','green_count':'green_majority','universe_leader':'leader',
  'basket_leader':'leader','price_zone':'price_zone','valuation_zone':'value_zone',
  'valuation_threshold':'valuation','price_threshold':'price','premium_band':'premium',
  'premium_sign':'discount','absolute_return':'move','relative_return':'relative',
  'valuation_ratio':'spread','joint_positive':'joint','basket_return_threshold':'basket'
 }.get(rt,'market')

def _migrate(m):
 m.setdefault('pricingMode','PARIMUTUEL')
 m.setdefault('family',_family(m)); m.setdefault('label',m.get('question','Market'))
 m.setdefault('yesPool',float(m.get('qYes',0))); m.setdefault('noPool',float(m.get('qNo',0)))
 m['qYes']=m['yesPool']; m['qNo']=m['noPool']; m.setdefault('collateral',m['yesPool']+m['noPool']); m.setdefault('paidOut',0.0); m.setdefault('fees',0.0)
 return m

def list_markets():
 d=_load(); out=[]
 for m in d['markets'].values():
  x=_migrate(dict(m)); x['yesProbability']=_prob(x); out.append(x)
 return sorted(out,key=lambda m:m.get('createdAt',0),reverse=True)

@serialized
def create_market(payload):
 d=_load(); mid=payload.get('id') or f'mkt_{uuid.uuid4().hex[:12]}'
 if mid in d['markets']: raise ValueError('market_exists')
 for k in ('underlyingMint','symbol','question','resolveAt'):
  if not payload.get(k): raise ValueError(f'missing_{k}')
 if payload['underlyingMint'] not in PRESTOCK_MINTS: raise ValueError('underlying_not_prestocks_eligible')
 m={'id':mid,'underlyingMint':payload['underlyingMint'],'symbol':payload['symbol'],'question':payload['question'],'rule':payload.get('rule',{}),'family':payload.get('family') or _family(payload),'label':payload.get('label') or payload['question'],
    'resolveAt':payload['resolveAt'],'collateralMint':payload.get('collateralMint','USDC'),'pricingMode':payload.get('pricingMode','PARIMUTUEL'),
    'feeBps':int(payload.get('feeBps',100)),'yesPool':0.0,'noPool':0.0,'qYes':0.0,'qNo':0.0,'collateral':0.0,'paidOut':0.0,'fees':0.0,
    'status':'OPEN','outcome':None,'volume':0.0,'trades':[],'createdAt':int(time.time()*1000),'creator':payload.get('creator') or 'stocklana'}
 d['markets'][mid]=m; _save(d); return {**m,'yesProbability':0.5}

def quote_market(mid,side,shares):
 d=_load(); m=d['markets'].get(mid)
 if not m: raise KeyError('market_not_found')
 m=_migrate(m)
 if m['status']!='OPEN': raise ValueError('market_not_open')
 if side not in ('YES','NO'): raise ValueError('invalid_side')
 stake=float(shares)
 if stake<=0: raise ValueError('invalid_stake')
 fee=stake*m['feeBps']/10000; y=m['yesPool']+(stake if side=='YES' else 0); n=m['noPool']+(stake if side=='NO' else 0)
 p=0.5 if y+n<=1e-12 else y/(y+n)
 return {'pricingMode':'PARIMUTUEL','side':side,'shares':stake,'stake':stake,'collateral':stake,'fee':fee,'total':stake+fee,'yesProbabilityAfter':p,
         'solvencyInvariant':'payouts<=escrowed_collateral'}

@serialized
def trade(mid,payload):
 d=_load(); m=d['markets'].get(mid)
 if not m: raise KeyError('market_not_found')
 m=_migrate(m)
 if m['status']!='OPEN': raise ValueError('market_not_open')
 side=payload.get('side'); stake=float(payload.get('shares',payload.get('stake',0)))
 q=quote_market(mid,side,stake); trader=payload.get('trader') or 'guest'
 if side=='YES':m['yesPool']+=stake
 else:m['noPool']+=stake
 m['qYes']=m['yesPool']; m['qNo']=m['noPool']; m['collateral']=m['yesPool']+m['noPool']; m['fees']+=q['fee']; m['volume']+=q['total']
 t={'trader':trader,'side':side,'shares':stake,'stake':stake,'collateral':stake,'fee':q['fee'],'total':q['total'],'at':int(time.time()*1000),
    'chainSignature':payload.get('chainSignature'),'chainSlot':payload.get('chainSlot'),'paymentMode':payload.get('paymentMode','vault')}
 m['trades'].append(t); k=f'{mid}:{trader}'; p=d['positions'].setdefault(k,{'marketId':mid,'trader':trader,'yes':0.0,'no':0.0,'spent':0.0,'redeemed':0.0})
 p['yes' if side=='YES' else 'no']+=stake; p['spent']+=q['total']; d['markets'][mid]=m; _save(d)
 return {'trade':t,'market':{**m,'yesProbability':_prob(m)},'position':p,'yesProbability':_prob(m)}

@serialized
def resolve(mid,payload):
 d=_load(); m=d['markets'].get(mid)
 if not m: raise KeyError('market_not_found')
 if m['status']!='OPEN': raise ValueError('market_not_open')
 out=payload.get('outcome')
 if out not in ('YES','NO'): raise ValueError('invalid_outcome')
 m=_migrate(m); m['status']='RESOLVED';m['outcome']=out;m['proof']=payload.get('proof');m['resolvedAt']=int(time.time()*1000);_save(d);return m

def position(mid,trader):return _load()['positions'].get(f'{mid}:{trader}',{'marketId':mid,'trader':trader,'yes':0,'no':0,'spent':0,'redeemed':0})

@serialized
def redeem(mid,trader):
 d=_load(); m=d['markets'].get(mid)
 if not m: raise KeyError('market_not_found')
 m=_migrate(m)
 if m['status']!='RESOLVED': raise ValueError('market_not_resolved')
 k=f'{mid}:{trader}';p=d['positions'].get(k)
 if not p: raise ValueError('position_not_found')
 if p.get('redeemed',0)>0:return {'payout':0.0,'position':p,'outcome':m['outcome'],'duplicate':True}
 field='yes' if m['outcome']=='YES' else 'no'; user_win=float(p.get(field,0)); winning_pool=float(m['yesPool'] if field=='yes' else m['noPool'])
 payout=0.0 if winning_pool<=1e-12 else user_win/winning_pool*float(m['collateral'])
 p['redeemed']=payout;m['paidOut']=float(m.get('paidOut',0))+payout;d['markets'][mid]=m;d['positions'][k]=p;_save(d)
 return {'payout':payout,'position':p,'outcome':m['outcome'],'escrowCollateral':m['collateral'],'winningPool':winning_pool}

@serialized
def transfer_position(mid,sender,recipient,side,shares):
 if side not in ('YES','NO'):raise ValueError('invalid_side')
 amount=float(shares)
 if amount<=0 or not recipient or recipient==sender:raise ValueError('invalid_transfer')
 d=_load();m=d['markets'].get(mid)
 if not m:raise KeyError('market_not_found')
 sk=f'{mid}:{sender}';rk=f'{mid}:{recipient}';sp=d['positions'].get(sk)
 if not sp:raise ValueError('position_not_found')
 f='yes' if side=='YES' else 'no'
 if float(sp.get(f,0))+1e-9<amount:raise ValueError('insufficient_position')
 sp[f]-=amount;rp=d['positions'].setdefault(rk,{'marketId':mid,'trader':recipient,'yes':0.0,'no':0.0,'spent':0.0,'redeemed':0.0});rp[f]+=amount
 d['positions'][sk]=sp;d['positions'][rk]=rp;_save(d);return {'marketId':mid,'sender':sender,'recipient':recipient,'side':side,'shares':amount,'senderPosition':sp,'recipientPosition':rp}

def all_positions(trader):
 d=_load();out=[]
 for p in d['positions'].values():
  if p.get('trader')==trader:
   m=d['markets'].get(p['marketId'],{});out.append({**p,'question':m.get('question'),'symbol':m.get('symbol'),'status':m.get('status'),'outcome':m.get('outcome')})
 return out
