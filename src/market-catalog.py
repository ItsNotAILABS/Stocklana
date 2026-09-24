import itertools

# Every template settles to YES/NO so Stocklana can share one clearing primitive
# across a much larger private-market derivatives universe.

def _b(v):
    return round(float(v) / 1e9, 1)

def _price(v):
    return round(float(v), 2)

def _mint(a):
    return a.get('contract_address') or a.get('underlyingMint') or ''

def _val(a):
    return float(a.get('impliedValuation') or a.get('implied_valuation') or 0)

def _mark_val(a):
    return float(a.get('markValuation') or a.get('mark_valuation') or _val(a))

def _token(a):
    return float(a.get('tokenPrice') or a.get('token_price') or 0)

def _mark(a):
    return float(a.get('markPrice') or a.get('mark_price') or _token(a))

def _add(out, **kwargs):
    if not kwargs.get('question'):
        return
    out.append(kwargs)

def templates(assets):
    out = []
    by = {a['symbol']: a for a in assets}

    for a in assets:
        sym = a['symbol']
        mint = _mint(a)
        val = max(_val(a), 1.0)
        tp = max(_token(a), 0.000001)
        markp = max(_mark(a), 0.000001)

        # Valuation ladder: produces a true term-sheet style surface instead of one target.
        for pct in (0.75, 0.90, 1.10, 1.25, 1.50):
            target = val * pct
            direction = 'above' if pct > 1 else 'below'
            _add(out,
                 family='valuation', label=f'Valuation {int(pct*100)}%', symbol=sym,
                 underlyingMint=mint,
                 question=f'Will {sym} implied valuation be {direction} ${_b(target)}B by resolution?',
                 rule={'type':'valuation_threshold','operator':'gte' if pct > 1 else 'lte','target':target,'metric':'impliedValuation','launchValue':val})

        # Token-price ladder.
        for pct in (0.80, 0.90, 1.10, 1.25, 1.50):
            target = tp * pct
            direction = 'above' if pct > 1 else 'below'
            _add(out,
                 family='price', label=f'Price {int(pct*100)}%', symbol=sym,
                 underlyingMint=mint,
                 question=f'Will {sym} trade {direction} ${_price(target)} by resolution?',
                 rule={'type':'price_threshold','operator':'gte' if pct > 1 else 'lte','target':target,'metric':'tokenPrice','launchValue':tp})

        # Premium / discount structure against PreStocks mark.
        for band in (2.5, 5.0, 10.0):
            _add(out,
                 family='premium', label=f'Premium within {band:g}%', symbol=sym,
                 underlyingMint=mint,
                 question=f'Will {sym} token premium to mark be within {band:g}% by resolution?',
                 rule={'type':'premium_band','absMaxPct':band,'metric':'token_vs_mark','launchToken':tp,'launchMark':markp})
        _add(out,
             family='discount', label='Trade at/below mark', symbol=sym, underlyingMint=mint,
             question=f'Will {sym} trade at or below its PreStocks mark by resolution?',
             rule={'type':'premium_sign','operator':'lte','targetPct':0,'metric':'token_vs_mark','launchToken':tp,'launchMark':markp})

        # Absolute-return and volatility markets can settle from the same price series.
        for move in (10, 20, 35):
            _add(out,
                 family='move', label=f'Absolute move > {move}%', symbol=sym, underlyingMint=mint,
                 question=f'Will {sym} move at least {move}% in either direction from launch by resolution?',
                 rule={'type':'absolute_return','absMinPct':move,'launchPrice':tp,'metric':'tokenPrice'})

    # High-signal pair universe. Ordered only once per pair to avoid duplicate mirrors.
    core_pairs = [
        ('OPENAI','ANTHROPIC'), ('SPACEX','ANDURIL'), ('KALSHI','POLYMARKET'),
        ('NEURALINK','FIGUREAI'), ('OPENAI','SPACEX'), ('ANTHROPIC','SPACEX'),
        ('OPENAI','FIGUREAI'), ('ANDURIL','NEURALINK')
    ]
    for left, right in core_pairs:
        if left not in by or right not in by:
            continue
        a, b = by[left], by[right]
        _add(out,
             family='relative', label='Relative return', symbol=left, underlyingMint=_mint(a),
             question=f'Will {left} outperform {right} from launch to resolution?',
             rule={'type':'relative_return','left':left,'right':right,'leftLaunchPrice':_token(a),'rightLaunchPrice':_token(b)})
        _add(out,
             family='spread', label='Valuation ratio', symbol=left, underlyingMint=_mint(a),
             question=f'Will {left}/{right} valuation ratio finish above its launch ratio?',
             rule={'type':'valuation_ratio','left':left,'right':right,'launchRatio':_val(a)/max(_val(b),1)})
        _add(out,
             family='joint', label='Both positive', symbol=left, underlyingMint=_mint(a),
             question=f'Will both {left} and {right} finish above their launch prices?',
             rule={'type':'joint_positive','members':[left,right],'launchPrices':{left:_token(a),right:_token(b)}})

    baskets = [
        ('FRONTIER_AI',['OPENAI','ANTHROPIC','FIGUREAI']),
        ('FUTURE_SYSTEMS',['SPACEX','ANDURIL','NEURALINK']),
        ('PREDICTION_INFRA',['KALSHI','POLYMARKET']),
        ('PRIVATE_TECH_8',[a['symbol'] for a in assets]),
    ]
    for name, members in baskets:
        if not members or not all(x in by for x in members):
            continue
        weights = [1/len(members)] * len(members)
        launch_prices = {x:_token(by[x]) for x in members}
        pretty = name.replace('_',' ').title()
        for threshold in (-10, 0, 10, 20):
            comparator = 'above' if threshold >= 0 else 'below'
            _add(out,
                 family='basket', label=f'{pretty} {threshold:+d}%', symbol=name,
                 underlyingMint=_mint(by[members[0]]),
                 question=f'Will the {pretty} equal-weight basket finish {comparator} {threshold:+d}% versus launch?',
                 rule={'type':'basket_return_threshold','members':members,'weights':weights,'thresholdPct':threshold,'launchPrices':launch_prices})
        for leader in members:
            _add(out,
                 family='leader', label=f'{leader} leads {pretty}', symbol=leader,
                 underlyingMint=_mint(by[leader]),
                 question=f'Will {leader} be the top-performing member of the {pretty} basket at resolution?',
                 rule={'type':'basket_leader','members':members,'candidate':leader,'launchPrices':launch_prices})

    # Cross-sectional tournament markets across all eight assets. These are useful even with
    # a small underlying universe because they transform a limited set into many expressions.
    symbols = [a['symbol'] for a in assets]
    if len(symbols) >= 4:
        launch_prices = {x:_token(by[x]) for x in symbols}
        for candidate in symbols:
            _add(out,
                 family='leader', label='Overall return leader', symbol=candidate,
                 underlyingMint=_mint(by[candidate]),
                 question=f'Will {candidate} be the best-performing PreStock in the full universe at resolution?',
                 rule={'type':'universe_leader','members':symbols,'candidate':candidate,'launchPrices':launch_prices})

    # Guarantee unique questions even if provider data creates coincident targets.
    unique = {}
    for item in out:
        unique[item['question']] = item
    return list(unique.values())

# v6 expansion: simple-to-explain financial games/instruments that still settle
# from the same PreStocks observations. These deliberately avoid exotic math in
# the user experience while multiplying useful expressions over eight assets.

def advanced_templates(assets):
    out=[]
    by={a['symbol']:a for a in assets}
    for a in assets:
        s=a['symbol']; mint=_mint(a); px=max(_token(a),1e-9); val=max(_val(a),1.0)
        # Price zones: binary range tickets.
        for lo,hi in ((0.75,0.90),(0.90,1.00),(1.00,1.10),(1.10,1.25),(1.25,1.50)):
            _add(out,family='price_zone',label=f'Price Zone {int(lo*100)}-{int(hi*100)}%',symbol=s,underlyingMint=mint,
                 question=f'Will {s} finish between ${_price(px*lo)} and ${_price(px*hi)}?',
                 rule={'type':'price_zone','low':px*lo,'high':px*hi,'metric':'tokenPrice','launchPrice':px})
        # Valuation zones.
        for lo,hi in ((0.75,0.90),(0.90,1.00),(1.00,1.10),(1.10,1.25),(1.25,1.50)):
            _add(out,family='value_zone',label=f'Value Zone {int(lo*100)}-{int(hi*100)}%',symbol=s,underlyingMint=mint,
                 question=f'Will {s} implied valuation finish between ${_b(val*lo)}B and ${_b(val*hi)}B?',
                 rule={'type':'valuation_zone','low':val*lo,'high':val*hi,'metric':'impliedValuation','launchValue':val})
        # Directional gain/downside games.
        for pct in (5,15,30):
            _add(out,family='gain_game',label=f'Gain Game +{pct}%',symbol=s,underlyingMint=mint,
                 question=f'Will {s} gain at least {pct}% from launch?',
                 rule={'type':'return_threshold','operator':'gte','thresholdPct':pct,'launchPrice':px})
            _add(out,family='downside_shield',label=f'Downside Shield {pct}%',symbol=s,underlyingMint=mint,
                 question=f'Will {s} avoid falling more than {pct}% from launch?',
                 rule={'type':'return_threshold','operator':'gte','thresholdPct':-pct,'launchPrice':px})

    # Margin duels ask a very simple question: which asset wins by at least X points?
    pairs=[('OPENAI','ANTHROPIC'),('SPACEX','ANDURIL'),('KALSHI','POLYMARKET'),('NEURALINK','FIGUREAI')]
    for l,r in pairs:
        if l not in by or r not in by: continue
        for margin in (0,5,10,20):
            _add(out,family='margin_duel',label=f'{l} by {margin}pts',symbol=l,underlyingMint=_mint(by[l]),
                 question=f'Will {l} outperform {r} by at least {margin} percentage points?',
                 rule={'type':'relative_margin','left':l,'right':r,'marginPct':margin,
                       'leftLaunchPrice':_token(by[l]),'rightLaunchPrice':_token(by[r])})

    # Green-majority basket game: easy social/competitive market surface.
    baskets=[('AI_TRIO',['OPENAI','ANTHROPIC','FIGUREAI']),('SPACE_DEFENSE',['SPACEX','ANDURIL','NEURALINK']),
             ('PREDICTION_PAIR',['KALSHI','POLYMARKET']),('ALL_PRESTOCKS',[a['symbol'] for a in assets])]
    for name,members in baskets:
        if not all(x in by for x in members): continue
        launch={x:_token(by[x]) for x in members}
        for need in range(1,len(members)+1):
            _add(out,family='green_majority',label=f'{name} {need}+ green',symbol=members[0],underlyingMint=_mint(by[members[0]]),
                 question=f'Will at least {need} of {len(members)} {name.replace("_"," ").title()} members finish above launch?',
                 rule={'type':'green_count','members':members,'minimum':need,'launchPrices':launch})
    return out

_original_templates = templates

def templates(assets):
    base=_original_templates(assets)
    merged={x['question']:x for x in base}
    for x in advanced_templates(assets): merged[x['question']]=x
    return list(merged.values())
