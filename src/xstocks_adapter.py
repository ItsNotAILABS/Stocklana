import json, urllib.request
BASE='https://api.backed.fi/api/v2/public/assets'

def _get(url):
    req=urllib.request.Request(url,headers={'accept':'application/json','user-agent':'Stocklana/0.7'})
    with urllib.request.urlopen(req,timeout=12) as r:return json.loads(r.read().decode())

def asset(symbol):
    s=str(symbol).strip()
    if not s: raise ValueError('symbol_required')
    return _get(f'{BASE}/{s}')

def price_data(symbol):
    s=str(symbol).strip()
    if not s: raise ValueError('symbol_required')
    return _get(f'{BASE}/{s}/price-data')

def solana_contract(product):
    # Backed's product payload can evolve; inspect common contract/network shapes
    # and return only a contract explicitly labelled Solana.
    candidates=[]
    if isinstance(product,dict):
        for key in ('contracts','networks','deployments','addresses'):
            v=product.get(key)
            if isinstance(v,list): candidates.extend(v)
            elif isinstance(v,dict):
                for network,value in v.items():
                    candidates.append({'network':network,'address':value} if isinstance(value,str) else {'network':network,**(value or {})})
    for c in candidates:
        if not isinstance(c,dict): continue
        net=str(c.get('network') or c.get('chain') or c.get('name') or '').lower()
        if 'solana' in net:
            return c.get('address') or c.get('contractAddress') or c.get('mint')
    return None

def capabilities():
    return {'lane':'PUBLIC_TOKENIZED_EQUITIES','provider':'xStocks/Backed public product data','assetEndpoint':BASE+'/{symbol}','priceEndpoint':BASE+'/{symbol}/price-data','separateFromPreStocksEligibility':True,'jurisdictionAndIssuerRulesMustBeChecked':True}
