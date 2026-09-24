import json, os, secrets, urllib.parse, urllib.request
USDC=os.getenv('STOCKLANA_USDC_MINT','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
JUP='https://api.jup.ag/swap/v2'
ALPH='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
def b58encode(raw):
 n=int.from_bytes(raw,'big'); out=''
 while n:n,r=divmod(n,58);out=ALPH[r]+out
 pad=len(raw)-len(raw.lstrip(b'\0'));return '1'*pad+(out or '')
def jupiter_order(input_mint,output_mint,amount_atomic,taker,receiver=None):
 key=os.getenv('JUPITER_API_KEY')
 if not key: return {'ready':False,'reason':'JUPITER_API_KEY_not_configured','api':'swap/v2','inputMint':input_mint,'outputMint':output_mint,'amount':str(amount_atomic),'taker':taker}
 q={'inputMint':input_mint,'outputMint':output_mint,'amount':str(int(amount_atomic)),'taker':taker}
 if receiver:q['receiver']=receiver
 referral=os.getenv('JUPITER_REFERRAL_ACCOUNT'); fee=os.getenv('JUPITER_REFERRAL_FEE')
 if referral and fee:q.update({'referralAccount':referral,'referralFee':str(int(fee))})
 url=JUP+'/order?'+urllib.parse.urlencode(q); req=urllib.request.Request(url,headers={'x-api-key':key,'User-Agent':'Stocklana/1.0'})
 with urllib.request.urlopen(req,timeout=12) as r:data=json.loads(r.read().decode())
 data['ready']=bool(data.get('transaction'));data['integration']='Jupiter Swap V2';return data
def jupiter_execute(signed_transaction,request_id):
 key=os.getenv('JUPITER_API_KEY')
 if not key: raise ValueError('JUPITER_API_KEY_not_configured')
 body=json.dumps({'signedTransaction':signed_transaction,'requestId':request_id}).encode(); req=urllib.request.Request(JUP+'/execute',data=body,method='POST',headers={'x-api-key':key,'content-type':'application/json','User-Agent':'Stocklana/1.0'})
 with urllib.request.urlopen(req,timeout=20) as r:return json.loads(r.read().decode())
def prestock_buy_order(prestock_mint,usdc_amount,taker):
 return jupiter_order(USDC,prestock_mint,round(float(usdc_amount)*1_000_000),taker)
def prestock_sell_order(prestock_mint,token_amount_atomic,taker):return jupiter_order(prestock_mint,USDC,int(token_amount_atomic),taker)
def solana_pay_request(recipient,amount,token=USDC,label='Stocklana',message='MAQUE payment',memo=''):
 if not recipient: raise ValueError('recipient_required')
 ref=b58encode(secrets.token_bytes(32)); q={'amount':str(float(amount)),'spl-token':token,'reference':ref,'label':label,'message':message}
 if memo:q['memo']=memo[:140]
 return {'protocol':'solana-pay','url':'solana:'+recipient+'?'+urllib.parse.urlencode(q),'reference':ref,'recipient':recipient,'amount':float(amount),'mint':token,'verification':'match reference + recipient + mint + amount on Solana RPC'}
def capabilities():
 return {'jupiterSwapV2':True,'jupiterConfigured':bool(os.getenv('JUPITER_API_KEY')),'integratorFeeConfigured':bool(os.getenv('JUPITER_REFERRAL_ACCOUNT') and os.getenv('JUPITER_REFERRAL_FEE')),'solanaPay':True,'agenticPayments':'MPP-compatible adapter surface','token2022Roadmap':['confidential-balances','transfer-fees','transfer-hooks','pausable','permanent-delegate']}
