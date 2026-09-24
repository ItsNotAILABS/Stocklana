import json,time,uuid,threading
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'data'/'challenges.json'
LOCK=threading.RLock()

def _load():
    if not DB.exists(): return {'challenges':{}}
    try:return json.loads(DB.read_text())
    except:return {'challenges':{}}

def _save(d):
    t=DB.with_suffix('.tmp');t.write_text(json.dumps(d,indent=2,sort_keys=True));t.replace(DB)

def create(creator,source_market,side,stake,ttl=86400):
    side=str(side or '').upper();stake=float(stake)
    if side not in {'YES','NO'}: raise ValueError('invalid_side')
    if stake<=0: raise ValueError('invalid_stake')
    if source_market.get('status')!='OPEN': raise ValueError('source_market_not_open')
    now=int(time.time());cid='duel_'+uuid.uuid4().hex[:16];mid='duel_mkt_'+uuid.uuid4().hex[:14]
    rec={
      'id':cid,'marketId':mid,'sourceMarketId':source_market['id'],'creator':creator,'creatorSide':side,
      'opponent':None,'opponentSide':'NO' if side=='YES' else 'YES','stakeUSDC':stake,'status':'WAITING',
      'symbol':source_market.get('symbol'),'question':source_market.get('question'),'family':source_market.get('family'),
      'createdAt':now,'expiresAt':now+max(300,min(int(ttl),604800))
    }
    with LOCK:
        d=_load();d['challenges'][cid]=rec;_save(d)
    market={
      'id':mid,'underlyingMint':source_market['underlyingMint'],'symbol':source_market['symbol'],
      'question':source_market['question'],'rule':source_market.get('rule') or {},'family':'head_to_head',
      'label':'HEAD TO HEAD · '+str(source_market.get('label') or source_market['question']),
      'resolveAt':source_market['resolveAt'],'feeBps':source_market.get('feeBps',100),'pricingMode':'PARIMUTUEL',
      'creator':creator,'challengeId':cid
    }
    return {'challenge':rec,'market':market}

def get(challenge_id):
    c=_load()['challenges'].get(challenge_id)
    if not c: raise ValueError('challenge_not_found')
    if c['status'] in {'WAITING','OPEN_FOR_OPPONENT'} and c['expiresAt']<int(time.time()):
        with LOCK:
            d=_load()
            if d['challenges'].get(challenge_id,{}).get('status') in {'WAITING','OPEN_FOR_OPPONENT'}:
                d['challenges'][challenge_id]['status']='EXPIRED';_save(d)
            c=d['challenges'][challenge_id]
    return c

def fail_creation(challenge_id,creator,reason):
    with LOCK:
        d=_load();c=d['challenges'].get(challenge_id)
        if c and c.get('creator')==creator and c.get('status')=='WAITING':
            c['status']='FAILED';c['failureReason']=str(reason)[:160];c['failedAt']=int(time.time());_save(d)
        return c

def mark_creator_funded(challenge_id,creator,trade):
    with LOCK:
        d=_load();c=d['challenges'].get(challenge_id)
        if not c or c['creator']!=creator: raise ValueError('challenge_not_found')
        if c['status']!='WAITING': raise ValueError('challenge_not_waiting')
        c['creatorTrade']=trade;c['creatorFundedAt']=int(time.time());c['status']='OPEN_FOR_OPPONENT';_save(d);return c

def begin_accept(challenge_id,opponent):
    with LOCK:
        d=_load();c=d['challenges'].get(challenge_id)
        if not c: raise ValueError('challenge_not_found')
        if c['creator']==opponent: raise ValueError('creator_cannot_accept_own_challenge')
        if c['expiresAt']<int(time.time()):
            c['status']='EXPIRED';_save(d);raise ValueError('challenge_expired')
        if c['status']!='OPEN_FOR_OPPONENT': raise ValueError('challenge_not_open')
        nonce=uuid.uuid4().hex
        c['status']='ACCEPTING';c['pendingOpponent']=opponent;c['acceptNonce']=nonce;c['acceptStartedAt']=int(time.time());_save(d)
        return {'challenge':dict(c),'nonce':nonce}

def finish_accept(challenge_id,opponent,nonce,trade):
    with LOCK:
        d=_load();c=d['challenges'].get(challenge_id)
        if not c or c.get('status')!='ACCEPTING' or c.get('pendingOpponent')!=opponent or c.get('acceptNonce')!=nonce: raise ValueError('challenge_accept_claim_lost')
        c['opponent']=opponent;c['opponentTrade']=trade;c['matchedAt']=int(time.time());c['status']='MATCHED'
        c.pop('pendingOpponent',None);c.pop('acceptNonce',None);c.pop('acceptStartedAt',None);_save(d);return c

def fail_accept(challenge_id,opponent,nonce,reason):
    with LOCK:
        d=_load();c=d['challenges'].get(challenge_id)
        if c and c.get('status')=='ACCEPTING' and c.get('pendingOpponent')==opponent and c.get('acceptNonce')==nonce:
            c['status']='OPEN_FOR_OPPONENT';c['lastAcceptError']=str(reason)[:160]
            c.pop('pendingOpponent',None);c.pop('acceptNonce',None);c.pop('acceptStartedAt',None);_save(d)
        return c

def cancel(challenge_id,user):
    d=_load();c=d['challenges'].get(challenge_id)
    if not c or c['creator']!=user: raise ValueError('challenge_not_found')
    if c['status'] not in {'WAITING','OPEN_FOR_OPPONENT','EXPIRED'}: raise ValueError('challenge_not_cancellable')
    c['status']='CANCELLED';c['cancelledAt']=int(time.time());_save(d);return c

def list_challenges(user=None,limit=50):
    vals=list(_load()['challenges'].values())
    if user: vals=[x for x in vals if x.get('creator')==user or x.get('opponent')==user]
    return sorted(vals,key=lambda x:x.get('createdAt',0),reverse=True)[:int(limit)]

def capabilities():
    return {'type':'HEAD_TO_HEAD_PRESTOCKS','matching':'invite-code','marketIsolation':True,'sides':['YES','NO'],'settlement':'same Stocklana market oracle + redemption engine','communityRequired':False}
