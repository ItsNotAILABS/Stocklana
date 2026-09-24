import json, os, urllib.request
API=os.getenv('KAMINO_API_BASE','https://api.kamino.finance').rstrip('/')

def _post(path,payload):
    req=urllib.request.Request(API+path,data=json.dumps(payload).encode(),headers={'content-type':'application/json','user-agent':'Stocklana/0.7'},method='POST')
    with urllib.request.urlopen(req,timeout=20) as r:return json.loads(r.read().decode())

def build_deposit(wallet,market,reserve,amount):
    if not wallet or not market or not reserve or float(amount)<=0: raise ValueError('wallet_market_reserve_amount_required')
    return _post('/ktx/klend/deposit',{'wallet':wallet,'market':market,'reserve':reserve,'amount':str(amount)})

def build_borrow(wallet,market,borrow_reserve,amount):
    if not wallet or not market or not borrow_reserve or float(amount)<=0: raise ValueError('wallet_market_reserve_amount_required')
    # Kamino transaction APIs return unsigned/base64 transactions; caller signs locally.
    return _post('/ktx/klend/borrow',{'wallet':wallet,'market':market,'reserve':borrow_reserve,'amount':str(amount)})

def capabilities():
    return {'provider':'Kamino','apiBase':API,'depositTransactionBuilder':'/ktx/klend/deposit','borrowTransactionBuilder':'/ktx/klend/borrow','clientSignsLocally':True,'stockCollateralRequiresLiveKaminoReserve':True}
