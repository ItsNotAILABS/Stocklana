import json, math, os, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = json.loads((ROOT/'data'/'prestocks-snapshot.json').read_text())
PRESTOCKS_URL = os.getenv('PRESTOCKS_API_URL','https://prestocks.com/api/prestocks')
PYTH_BASE = os.getenv('PYTH_HERMES_URL','https://pyth.dourolabs.app/hermes').rstrip('/')


def _num(v, default=0.0):
    try: return float(v)
    except Exception: return float(default)


def fetch_prestocks(timeout=3):
    req = urllib.request.Request(PRESTOCKS_URL, headers={'User-Agent':'StocklanaKeeper/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode())
        if not isinstance(data, list) or not data: raise ValueError('empty_prestocks')
        return {'source':'PreStocks','fetchedAt':int(time.time()),'assets':data,'live':True}
    except Exception as e:
        return {'source':'PreStocks','fetchedAt':int(time.time()),'assets':SNAPSHOT,'live':False,'fallbackReason':str(e)}


def fetch_pyth(feed_id, timeout=4):
    if not feed_id: return None
    key = os.getenv('PYTH_API_KEY')
    if not key: return {'source':'Pyth','feedId':feed_id,'available':False,'reason':'PYTH_API_KEY_not_configured'}
    url = f"{PYTH_BASE}/v2/updates/price/latest?ids%5B%5D={feed_id}"
    req = urllib.request.Request(url, headers={'Authorization':f'Bearer {key}','User-Agent':'StocklanaKeeper/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode())
    p = (data.get('parsed') or [None])[0]
    if not p: raise ValueError('pyth_missing_parsed_price')
    q = p['price']; expo = int(q['expo']); raw = int(q['price']); conf = int(q['conf'])
    return {'source':'Pyth','feedId':feed_id,'available':True,'price':raw*(10**expo),'confidence':conf*(10**expo),'publishTime':q['publish_time'],'raw':p}


def _asset_map(obs): return {a['symbol']: a for a in obs['assets']}

def _ret(now, launch): return ((_num(now)/max(_num(launch),1e-18))-1.0)*100.0

def _premium_pct(a):
    token=_num(a.get('tokenPrice')); mark=_num(a.get('markPrice'))
    return ((token/max(mark,1e-18))-1.0)*100.0


def evaluate_rule(rule, assets):
    t = rule.get('type')
    by = {a['symbol']:a for a in assets}
    if t in ('valuation_threshold','price_threshold'):
        metric=rule['metric']; target=_num(rule['target']); op=rule.get('operator','gte')
        # symbol is carried by market; evaluator receives __symbol injected by keeper
        a=by[rule['__symbol']]; value=_num(a.get(metric))
        yes = value >= target if op=='gte' else value <= target
        return yes, {'metric':metric,'value':value,'target':target,'operator':op}
    if t=='premium_band':
        a=by[rule['__symbol']]; p=_premium_pct(a); lim=_num(rule['absMaxPct'])
        return abs(p)<=lim, {'metric':'token_vs_mark_pct','value':p,'absMaxPct':lim}
    if t=='premium_sign':
        a=by[rule['__symbol']]; p=_premium_pct(a); target=_num(rule.get('targetPct',0)); op=rule.get('operator','lte')
        yes = p <= target if op=='lte' else p >= target
        return yes, {'metric':'token_vs_mark_pct','value':p,'targetPct':target,'operator':op}
    if t=='absolute_return':
        a=by[rule['__symbol']]; r=_ret(a.get('tokenPrice'),rule['launchPrice']); lim=_num(rule['absMinPct'])
        return abs(r)>=lim, {'metric':'absolute_return_pct','value':r,'absMinPct':lim}
    if t=='relative_return':
        l,r=rule['left'],rule['right']; lr=_ret(by[l]['tokenPrice'],rule['leftLaunchPrice']); rr=_ret(by[r]['tokenPrice'],rule['rightLaunchPrice'])
        return lr>rr, {'leftReturnPct':lr,'rightReturnPct':rr}
    if t=='valuation_ratio':
        l,r=rule['left'],rule['right']; ratio=_num(by[l]['impliedValuation'])/max(_num(by[r]['impliedValuation']),1e-18); launch=_num(rule['launchRatio'])
        return ratio>launch, {'ratio':ratio,'launchRatio':launch}
    if t=='joint_positive':
        vals={s:_ret(by[s]['tokenPrice'],rule['launchPrices'][s]) for s in rule['members']}
        return all(v>0 for v in vals.values()), {'returnsPct':vals}
    if t=='basket_return_threshold':
        rs=[]
        for s,w in zip(rule['members'],rule['weights']): rs.append(_ret(by[s]['tokenPrice'],rule['launchPrices'][s])*_num(w))
        basket=sum(rs); threshold=_num(rule['thresholdPct'])
        return basket>=threshold, {'basketReturnPct':basket,'thresholdPct':threshold}
    if t in ('basket_leader','universe_leader'):
        vals={s:_ret(by[s]['tokenPrice'],rule['launchPrices'][s]) for s in rule['members']}; leader=max(vals,key=vals.get)
        return leader==rule['candidate'], {'leader':leader,'returnsPct':vals,'candidate':rule['candidate']}
    if t=='price_zone':
        a=by[rule['__symbol']]; value=_num(a.get('tokenPrice')); lo=_num(rule['low']); hi=_num(rule['high'])
        return lo <= value <= hi, {'metric':'tokenPrice','value':value,'low':lo,'high':hi}
    if t=='valuation_zone':
        a=by[rule['__symbol']]; value=_num(a.get('impliedValuation')); lo=_num(rule['low']); hi=_num(rule['high'])
        return lo <= value <= hi, {'metric':'impliedValuation','value':value,'low':lo,'high':hi}
    if t=='return_threshold':
        a=by[rule['__symbol']]; value=_ret(a.get('tokenPrice'),rule['launchPrice']); target=_num(rule['thresholdPct']); op=rule.get('operator','gte')
        yes=value >= target if op=='gte' else value <= target
        return yes, {'metric':'return_pct','value':value,'target':target,'operator':op}
    if t=='relative_margin':
        l,r=rule['left'],rule['right']; lr=_ret(by[l]['tokenPrice'],rule['leftLaunchPrice']); rr=_ret(by[r]['tokenPrice'],rule['rightLaunchPrice']); margin=_num(rule.get('marginPct',0))
        return (lr-rr)>=margin, {'leftReturnPct':lr,'rightReturnPct':rr,'spreadPct':lr-rr,'marginPct':margin}
    if t=='green_count':
        vals={s:_ret(by[s]['tokenPrice'],rule['launchPrices'][s]) for s in rule['members']}; count=sum(1 for v in vals.values() if v>0); need=int(rule['minimum'])
        return count>=need, {'greenCount':count,'minimum':need,'returnsPct':vals}
    raise ValueError(f'unsupported_rule:{t}')


def parse_time(value):
    if value is None: return None
    if isinstance(value,(int,float)): return float(value)
    s=str(value).replace('Z','+00:00')
    dt=datetime.fromisoformat(s)
    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def is_due(market, now=None):
    now=time.time() if now is None else now
    ts=parse_time(market.get('resolveAt'))
    return ts is not None and now>=ts


def resolve_observation(market, prestocks_obs=None):
    obs=prestocks_obs or fetch_prestocks()
    rule=dict(market.get('rule') or {}); rule['__symbol']=market.get('symbol')
    yes, details=evaluate_rule(rule,obs['assets'])
    proof={
        'version':2,'oracleMode':'AUTOMATIC','primarySource':'PreStocks',
        'sourceLive':obs.get('live',False),'observedAt':obs['fetchedAt'],
        'marketId':market['id'],'symbol':market.get('symbol'),'ruleType':rule.get('type'),
        'details':details,'outcome':'YES' if yes else 'NO'
    }
    feed=(market.get('rule') or {}).get('pythFeedId')
    if feed:
        try: proof['pyth']=fetch_pyth(feed)
        except Exception as e: proof['pyth']={'source':'Pyth','available':False,'reason':str(e)}
    return proof
