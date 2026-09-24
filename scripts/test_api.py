import json, subprocess, time, urllib.request, urllib.error, os
ROOT=os.path.dirname(os.path.dirname(__file__))
env={**os.environ,'STOCKLANA_DEV_CREDIT':'1','STOCKLANA_DEV_AUTH':'1','STOCKLANA_DEV_KEEPER':'1'}
p=subprocess.Popen(['python3','server.py','--port','5188'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env)
try:
    time.sleep(2.5)
    def req(path,method='GET',body=None):
        data=None if body is None else json.dumps(body).encode()
        r=urllib.request.Request('http://127.0.0.1:5188'+path,data=data,method=method,headers={'content-type':'application/json'})
        with urllib.request.urlopen(r,timeout=5) as x:return json.loads(x.read())
    health=req('/api/health'); assert 'vault' in health['finance']
    templates=req('/api/market-templates'); assert len(templates)>=300
    universe=req('/api/market-universe'); assert universe['templateCount']>=300 and universe['underlyingCount']==8
    req('/api/vault/credit','POST',{'trader':'alice','amount':500,'asset':'USDC'})
    a=req('/api/vault?trader=alice'); assert a['balances']['USDC']>=500
    m=req('/api/markets','POST',{'underlyingMint':'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF','symbol':'OPENAI','question':'Will test resolve?','resolveAt':'2027-01-01','liquidity':1000,'creator':'tester'})
    mid=m['id']; q=req(f'/api/markets/{mid}/quote','POST',{'side':'YES','shares':20}); assert q['total']>0
    t=req(f'/api/markets/{mid}/trade','POST',{'side':'YES','shares':20,'trader':'alice','paymentMode':'vault'}); assert t['market']['qYes']==20
    pos=req(f'/api/position/{mid}?trader=alice'); assert pos['yes']==20
    req(f'/api/markets/{mid}/transfer-position','POST',{'trader':'alice','recipient':'bob','side':'YES','shares':5})
    b=req(f'/api/position/{mid}?trader=bob'); assert b['yes']==5
    m2=req(f'/api/markets/{mid}/resolve','POST',{'outcome':'YES','proof':{'source':'test'}}); assert m2['outcome']=='YES'
    red=req(f'/api/markets/{mid}/redeem','POST',{'trader':'bob'}); assert red['payout']==5
    bv=req('/api/vault?trader=bob'); assert bv['balances']['USDC']>=5
    receipts=req('/api/receipts?limit=20'); assert len(receipts['receipts'])>=3
    print('PASS HTTP market+vault+position-transfer+redeem',mid)
finally:
    p.terminate(); p.wait(timeout=3)
