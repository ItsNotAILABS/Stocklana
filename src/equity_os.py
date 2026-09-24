import json, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data' / 'equity-os.json'
PRESTOCKS = {x['symbol']: x for x in json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text())}

DEFAULT = {'plans': {}, 'baskets': {}, 'robo': {}, 'corporateActions': {}, 'social': {}}

def _load():
    try:
        if DB.exists():
            d = json.loads(DB.read_text())
            for k,v in DEFAULT.items(): d.setdefault(k, {} if isinstance(v,dict) else v)
            return d
    except Exception:
        pass
    return json.loads(json.dumps(DEFAULT))

def _save(d):
    DB.parent.mkdir(parents=True, exist_ok=True)
    tmp = DB.with_suffix('.tmp'); tmp.write_text(json.dumps(d, indent=2, sort_keys=True)); tmp.replace(DB)

def _asset(symbol):
    s = (symbol or '').upper()
    if s not in PRESTOCKS: raise ValueError('prestocks_asset_required')
    return PRESTOCKS[s]

def recurring_plan(owner, symbol, usdc_amount, cadence='WEEKLY', day=None, active=True):
    a = _asset(symbol); amount=float(usdc_amount)
    if amount <= 0: raise ValueError('invalid_amount')
    if cadence not in {'DAILY','WEEKLY','MONTHLY'}: raise ValueError('invalid_cadence')
    d=_load(); pid='rcb_'+uuid.uuid4().hex[:16]
    rec={'id':pid,'owner':owner,'type':'RECURRING_BUY','symbol':a['symbol'],'mint':a['contract_address'],'usdcAmount':amount,'cadence':cadence,'day':day,'active':bool(active),'createdAt':int(time.time()),'executionRail':'JUPITER_SWAP_V2','requiresWalletAuthorization':True}
    d['plans'][pid]=rec;_save(d);return rec

def next_recurring_actions(owner):
    now=int(time.time()); d=_load(); out=[]
    for p in d['plans'].values():
        if p['owner']!=owner or not p.get('active'): continue
        out.append({**p,'due':True,'asOf':now,'action':{'kind':'PRESTOCK_SWAP','mint':p['mint'],'inputAsset':'USDC','amount':p['usdcAmount']}})
    return out

def create_basket(owner, name, members, weights=None, rebalance='MONTHLY'):
    syms=[str(x).upper() for x in members]
    if len(syms)<2: raise ValueError('basket_needs_two_assets')
    assets=[_asset(s) for s in syms]
    if weights is None: weights=[1/len(assets)]*len(assets)
    weights=[float(w) for w in weights]
    if len(weights)!=len(assets) or abs(sum(weights)-1)>1e-6: raise ValueError('weights_must_sum_to_one')
    bid='basket_'+uuid.uuid4().hex[:16]; d=_load()
    rec={'id':bid,'owner':owner,'name':name or 'Stocklana Basket','type':'INDEX_BASKET','rebalance':rebalance,'members':[{'symbol':a['symbol'],'mint':a['contract_address'],'weight':w} for a,w in zip(assets,weights)],'createdAt':int(time.time()),'executionRail':'JUPITER_SWAP_V2'}
    d['baskets'][bid]=rec;_save(d);return rec

def basket_orders(basket_id, total_usdc):
    d=_load(); b=d['baskets'].get(basket_id)
    if not b: raise ValueError('basket_not_found')
    total=float(total_usdc)
    if total<=0: raise ValueError('invalid_amount')
    return {'basketId':basket_id,'totalUSDC':total,'orders':[{'symbol':m['symbol'],'mint':m['mint'],'usdcAmount':round(total*m['weight'],6),'rail':'JUPITER_SWAP_V2'} for m in b['members']]}

def create_robo(owner, risk='BALANCED', monthly_usdc=250):
    risk=risk.upper(); presets={
      'CONSERVATIVE': [('SPACEX',.35),('OPENAI',.25),('ANTHROPIC',.20),('ANDURIL',.20)],
      'BALANCED': [('OPENAI',.25),('SPACEX',.25),('ANTHROPIC',.20),('ANDURIL',.15),('FIGUREAI',.15)],
      'GROWTH': [('OPENAI',.25),('ANTHROPIC',.25),('FIGUREAI',.20),('NEURALINK',.15),('SPACEX',.15)]}
    if risk not in presets: raise ValueError('invalid_risk_profile')
    rid='robo_'+uuid.uuid4().hex[:16]; d=_load()
    rec={'id':rid,'owner':owner,'risk':risk,'monthlyUSDC':float(monthly_usdc),'allocation':[{'symbol':s,'mint':_asset(s)['contract_address'],'weight':w} for s,w in presets[risk]],'rebalance':'MONTHLY','requiresPolicyScopedAgent':True,'createdAt':int(time.time())}
    d['robo'][rid]=rec;_save(d);return rec

def record_corporate_action(symbol, action_type, effective_at, payload, source='ISSUER_OR_PROVIDER'):
    a=_asset(symbol); aid='ca_'+uuid.uuid4().hex[:16]; d=_load()
    rec={'id':aid,'symbol':a['symbol'],'mint':a['contract_address'],'type':str(action_type).upper(),'effectiveAt':effective_at,'payload':payload or {},'source':source,'status':'PENDING','createdAt':int(time.time())}
    d['corporateActions'][aid]=rec;_save(d);return rec

def corporate_actions(symbol=None):
    vals=list(_load()['corporateActions'].values())
    if symbol: vals=[x for x in vals if x['symbol']==symbol.upper()]
    return vals

def social_signal(owner, symbol, thesis, visibility='FRIENDS'):
    a=_asset(symbol); d=_load(); sid='sig_'+uuid.uuid4().hex[:16]
    rec={'id':sid,'owner':owner,'symbol':a['symbol'],'mint':a['contract_address'],'thesis':str(thesis)[:500],'visibility':visibility,'createdAt':int(time.time()),'copyAction':{'kind':'PRESTOCK_SWAP','mint':a['contract_address']}}
    d['social'][sid]=rec;_save(d);return rec

def capabilities():
    return {
      'wedge':'PROGRAMMABLE_TOKENIZED_EQUITY_OWNERSHIP',
      'trading':['Jupiter PreStock<->USDC execution','fully collateralized programmable equity markets'],
      'investing':['recurring buys','index baskets','policy-scoped robo portfolios'],
      'creditYield':['stock-collateral credit adapter','pool-funded credit','corporate-action/dividend event ingestion'],
      'infrastructure':['PreStocks/Pyth observation plane','corporate-action registry','compliance-ready wallet auth','solvency analytics'],
      'consumer':['mobile/laptop investing','social/copy signals','MAQUE portfolio spending','one-use card policies'],
      'programmableAssets':['360 settleable instruments','agent vault automations','ISO 20022 payment translation']
    }
