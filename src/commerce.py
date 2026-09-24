import json, time, uuid, urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'data'/'commerce-intents.json'

def _load():
    if not DB.exists(): return {'intents':{}}
    try: return json.loads(DB.read_text())
    except Exception: return {'intents':{}}

def _save(d):
    t=DB.with_suffix('.tmp'); t.write_text(json.dumps(d,indent=2,sort_keys=True)); t.replace(DB)

def _host(url):
    u=urllib.parse.urlparse(str(url or '').strip())
    if u.scheme not in {'http','https'} or not u.netloc: raise ValueError('valid_https_merchant_url_required')
    return u.netloc.lower()

def create_intent(user, merchant_url, amount_usdc, funding_source='WALLET_USDC', merchant=None, agent_id=None, approval_above=None, allow_subscriptions=False, note=''):
    amount=float(amount_usdc)
    if amount<=0: raise ValueError('invalid_amount')
    if funding_source not in {'WALLET_USDC','STOCKLANA_USDC'}: raise ValueError('unsupported_funding_source')
    host=_host(merchant_url)
    iid='buy_'+uuid.uuid4().hex[:18]; now=int(time.time())
    obj={
        'id':iid,'user':user,'merchantUrl':merchant_url,'merchantHost':host,
        'merchant':merchant or host,'maxAmountUSDC':amount,'fundingSource':funding_source,
        'agentId':agent_id or None,'approvalAboveUSDC':float(approval_above) if approval_above not in (None,'') else amount,
        'allowSubscriptions':bool(allow_subscriptions),'note':str(note or '')[:240],
        'status':'AWAITING_FUNDS' if funding_source=='WALLET_USDC' else 'READY_TO_RESERVE',
        'createdAt':now,'expiresAt':now+1800,'cardPolicyId':None,'provider':None
    }
    d=_load(); d['intents'][iid]=obj; _save(d); return obj

def get_intent(user, intent_id):
    obj=_load()['intents'].get(intent_id)
    if not obj or obj.get('user')!=user: raise ValueError('purchase_intent_not_found')
    return obj

def mark_funded(user,intent_id,reference):
    d=_load(); obj=d['intents'].get(intent_id)
    if not obj or obj.get('user')!=user: raise ValueError('purchase_intent_not_found')
    if obj['status'] not in {'AWAITING_FUNDS','READY_TO_RESERVE'}: raise ValueError('purchase_intent_not_fundable')
    obj['status']='FUNDED'; obj['fundingReference']=reference; obj['fundedAt']=int(time.time()); _save(d); return obj

def attach_card(user,intent_id,policy,issuance):
    d=_load(); obj=d['intents'].get(intent_id)
    if not obj or obj.get('user')!=user: raise ValueError('purchase_intent_not_found')
    obj['cardPolicyId']=policy.get('id'); obj['provider']=issuance.get('providerStatus') or issuance.get('reason')
    obj['status']='PURCHASE_READY' if issuance.get('ready') else 'POLICY_RESERVED_PROVIDER_REQUIRED'
    obj['purchaseReady']=bool(issuance.get('ready')); obj['activatedAt']=int(time.time())
    obj['hostedRevealUrl']=issuance.get('hostedRevealUrl')
    obj['walletPassUrl']=issuance.get('walletPassUrl')
    _save(d)
    return {'intent':obj,'policy':policy,'issuance':issuance}

def mark_opened(user,intent_id):
    d=_load(); obj=d['intents'].get(intent_id)
    if not obj or obj.get('user')!=user: raise ValueError('purchase_intent_not_found')
    obj['merchantOpenedAt']=int(time.time()); _save(d); return obj

def list_intents(user,limit=30):
    vals=[x for x in _load()['intents'].values() if x.get('user')==user]
    return sorted(vals,key=lambda x:x.get('createdAt',0),reverse=True)[:int(limit)]

def capabilities():
    return {
      'name':'Stocklana Commerce',
      'fundingSources':['WALLET_USDC','STOCKLANA_USDC'],
      'merchantBoundSingleUsePolicies':True,
      'agentPurchaseIntents':True,
      'subscriptionDefault':'BLOCKED',
      'walletCustody':False,
      'externalPurchaseRail':'issuer-hosted one-time card when CARD_ISSUER_PROXY is configured'
    }
