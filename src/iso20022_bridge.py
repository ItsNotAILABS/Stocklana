from datetime import datetime, timezone
import uuid

SCHEME='STOCKLANA-ISO20022-v1'

def _id(prefix): return f'{prefix}-{uuid.uuid4().hex[:20]}'
def _now(): return datetime.now(timezone.utc).isoformat()

def pain001(debtor, creditor, amount, asset='USDC', memo='', rail='internal'):
    return {'scheme':SCHEME,'message':'pain.001','messageId':_id('pain'), 'createdAt':_now(),
      'paymentInformation':{'debtor':debtor,'creditor':creditor,'instructedAmount':{'currency':asset,'value':float(amount)},'remittanceInformation':memo,'requestedRail':rail}}

def pacs008(payment, settlement_ref=None, status='ACCEPTED'):
    p=payment['paymentInformation']
    return {'scheme':SCHEME,'message':'pacs.008','messageId':_id('pacs'),'createdAt':_now(),'originalMessageId':payment['messageId'],
      'settlement':{'status':status,'rail':p['requestedRail'],'reference':settlement_ref,'amount':p['instructedAmount'],'debtor':p['debtor'],'creditor':p['creditor']}}

def camt053(account, balances, entries):
    return {'scheme':SCHEME,'message':'camt.053','messageId':_id('camt'),'createdAt':_now(),'account':account,'balances':balances,'entries':entries}

def remt001(payment, structured=None):
    return {'scheme':SCHEME,'message':'remt.001','messageId':_id('remt'),'createdAt':_now(),'originalMessageId':payment['messageId'],'remittance':structured or {'unstructured':payment['paymentInformation'].get('remittanceInformation','')}}

def capabilities():
    return {'scheme':SCHEME,'messages':{
      'pain.001':'payment initiation / MAQUE intent','pacs.008':'clearing and settlement instruction','camt.053':'account statement / reconciliation','remt.001':'remittance context'},
      'railMap':{'internal':'Stocklana ledger','solana':'Solana USDC','card':'issuer/processor JIT authorization','bank':'bank/ACH/instant-payment connector'},
      'principle':'one canonical payment object, multiple settlement rails'}
