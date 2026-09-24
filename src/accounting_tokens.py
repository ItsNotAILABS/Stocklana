from __future__ import annotations
import json, time, uuid, threading, functools, hashlib
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Dict, Iterable, List

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
DB = DATA / 'token-ledger.json'
LOCK = threading.RLock()
Q = Decimal('0.000001')

# Stocklana V2 internal accounting grammar. These are typed claims/capabilities,
# not independent promises of value. Monetary receipts must reconcile to external
# settlement assets or funded receivables.
TOKEN_REGISTRY: Dict[str, Dict[str, Any]] = {
    'SL-CASH': {
        'version': 'V2', 'class': 'SETTLEMENT_RECEIPT', 'unit': 'USDC',
        'transferability': 'INTERNAL', 'backing': '1:1 segregated USDC',
        'purpose': 'User spendable balance inside Stocklana/MAQUE.'
    },
    'SL-ESCROW': {
        'version': 'V2', 'class': 'MARKET_ESCROW_RECEIPT', 'unit': 'USDC',
        'transferability': 'PROGRAM_ONLY', 'backing': '1:1 market-segregated USDC',
        'purpose': 'Restricted market collateral; cannot be spent elsewhere.'
    },
    'SL-COLL': {
        'version': 'V2', 'class': 'COLLATERAL_RECEIPT', 'unit': 'USDC_EQUIV',
        'transferability': 'PROGRAM_ONLY', 'backing': 'locked collateral inventory',
        'purpose': 'Represents collateral locked for credit/structured products.'
    },
    'SL-FEE': {
        'version': 'V2', 'class': 'PROTOCOL_FEE_ACCRUAL', 'unit': 'USDC',
        'transferability': 'TREASURY_ONLY', 'backing': 'captured USDC fees',
        'purpose': 'Protocol revenue awaiting treasury sweep.'
    },
    'SL-CREDIT': {
        'version': 'V2', 'class': 'FUNDED_CREDIT_RECEIVABLE', 'unit': 'USDC',
        'transferability': 'PROGRAM_ONLY', 'backing': 'borrower receivable + collateral policy',
        'purpose': 'Tracks funded principal; never created without a funding source.'
    },
    'SL-AGENT': {
        'version': 'V2', 'class': 'AGENT_BUDGET_CAPABILITY', 'unit': 'USDC_LIMIT',
        'transferability': 'NON_TRANSFERABLE', 'backing': 'owner-defined spend authority',
        'purpose': 'Scoped agent spending capacity; not money and not redeemable.'
    },
    'SL-POS': {
        'version': 'V2', 'class': 'MARKET_POSITION_CLAIM', 'unit': 'SHARE',
        'transferability': 'INTERNAL_TRANSFERABLE', 'backing': 'market escrow + resolution rule',
        'purpose': 'YES/NO or other programmable market position claim.'
    },
    'SL-BASKET': {
        'version': 'V2', 'class': 'BASKET_RECEIPT', 'unit': 'SHARE',
        'transferability': 'INTERNAL_TRANSFERABLE', 'backing': 'segregated underlying inventory',
        'purpose': 'Receipt for a weighted basket/robo portfolio inventory.'
    },
}

# V2 maps selected internal semantics to Solana Token-2022 only where public composability
# improves the product. Internal bookkeeping remains the source of accounting truth.
V2_TOKEN_2022_BLUEPRINTS = {
    'SL-CASH': {
        'onchain': False,
        'reason': 'Keep internal settlement receipt off-chain until issuer/compliance model permits transferable cash claims.'
    },
    'SL-ESCROW': {
        'onchain': True, 'extensions': ['MetadataPointer', 'TokenMetadata', 'NonTransferable'],
        'authority': 'market-program-pda', 'decimals': 6,
        'reason': 'Public proof of escrow claim without user-to-user transfer.'
    },
    'SL-COLL': {
        'onchain': True, 'extensions': ['MetadataPointer', 'TokenMetadata', 'NonTransferable'],
        'authority': 'collateral-program-pda', 'decimals': 6,
        'reason': 'Composable collateral state while preventing unsupported secondary transfer.'
    },
    'SL-FEE': {
        'onchain': False,
        'reason': 'Treasury accounting does not need another public bearer asset.'
    },
    'SL-CREDIT': {
        'onchain': True, 'extensions': ['MetadataPointer', 'TokenMetadata', 'NonTransferable'],
        'authority': 'credit-program-pda', 'decimals': 6,
        'reason': 'Auditable principal marker; funding and collateral rules remain program controlled.'
    },
    'SL-AGENT': {
        'onchain': True, 'extensions': ['MetadataPointer', 'TokenMetadata', 'NonTransferable'],
        'authority': 'agent-vault-program-pda', 'decimals': 6,
        'reason': 'Machine-readable allowance/capability, never a freely transferable currency.'
    },
    'SL-POS': {
        'onchain': True, 'extensions': ['MetadataPointer', 'TokenMetadata', 'TransferHook'],
        'authority': 'market-program-pda', 'decimals': 6,
        'reason': 'Transferable composable market claim with program-enforced transfer policy.'
    },
    'SL-BASKET': {
        'onchain': True, 'extensions': ['MetadataPointer', 'TokenMetadata', 'TransferHook'],
        'authority': 'basket-program-pda', 'decimals': 9,
        'reason': 'Composable basket share while enforcing inventory/compliance hooks.'
    },
}


def _d(v: Any) -> Decimal:
    return Decimal(str(v)).quantize(Q, rounding=ROUND_HALF_UP)


def _default() -> Dict[str, Any]:
    return {
        'version': 2,
        'journal': [],
        'accounts': {},
        'tokenBalances': {},
        'externalInventory': {'USDC': '0.000000', 'SOL': '0.000000'},
        'receiptHead': '0' * 128,
        'sequence': 0,
        'processedEvents': {},
    }


def _load() -> Dict[str, Any]:
    if not DB.exists():
        return _default()
    try:
        base = _default(); base.update(json.loads(DB.read_text())); return base
    except Exception:
        return _default()


def _save(db: Dict[str, Any]):
    tmp = DB.with_suffix('.tmp')
    tmp.write_text(json.dumps(db, indent=2, sort_keys=True))
    tmp.replace(DB)


def _canon(x: Any) -> bytes:
    return json.dumps(x, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def _commit(x: Any) -> str:
    return hashlib.blake2b(_canon(x), digest_size=64).hexdigest()


def _account(db: Dict[str, Any], name: str) -> Decimal:
    return _d(db['accounts'].get(name, '0'))


def _set_account(db: Dict[str, Any], name: str, value: Decimal):
    db['accounts'][name] = str(value.quantize(Q))


def _token_bucket(db: Dict[str, Any], symbol: str) -> Dict[str, str]:
    return db['tokenBalances'].setdefault(symbol, {})


def _token_get(db: Dict[str, Any], symbol: str, holder: str) -> Decimal:
    return _d(_token_bucket(db, symbol).get(holder, '0'))


def _token_set(db: Dict[str, Any], symbol: str, holder: str, value: Decimal):
    if value < 0:
        raise ValueError('negative_token_balance')
    _token_bucket(db, symbol)[holder] = str(value.quantize(Q))


def _move_token(db: Dict[str, Any], symbol: str, sender: str | None, recipient: str | None, amount: Decimal):
    if amount < 0: raise ValueError('invalid_token_amount')
    if sender:
        bal = _token_get(db, symbol, sender)
        if bal < amount: raise ValueError(f'insufficient_{symbol}')
        _token_set(db, symbol, sender, bal - amount)
    if recipient:
        _token_set(db, symbol, recipient, _token_get(db, symbol, recipient) + amount)


def _post(db: Dict[str, Any], event: str, entries: Iterable[Dict[str, Any]], metadata: Dict[str, Any] | None = None):
    es = [{'account': e['account'], 'debit': str(_d(e.get('debit', 0))), 'credit': str(_d(e.get('credit', 0)))} for e in entries]
    debits = sum((_d(e['debit']) for e in es), Decimal('0'))
    credits = sum((_d(e['credit']) for e in es), Decimal('0'))
    if debits != credits:
        raise ValueError(f'unbalanced_journal:{debits}:{credits}')
    for e in es:
        cur = _account(db, e['account'])
        _set_account(db, e['account'], cur + _d(e['debit']) - _d(e['credit']))
    db['sequence'] += 1
    body = {'sequence': db['sequence'], 'event': event, 'entries': es, 'metadata': metadata or {}, 'at': int(time.time()*1000), 'prev': db['receiptHead']}
    body['commitment'] = _commit(body)
    db['receiptHead'] = body['commitment']
    db['journal'].append(body)
    db['journal'] = db['journal'][-10000:]
    return body


def _external(db: Dict[str, Any], asset: str) -> Decimal:
    return _d(db['externalInventory'].get(asset, '0'))


def _set_external(db: Dict[str, Any], asset: str, amount: Decimal):
    if amount < 0: raise ValueError('negative_external_inventory')
    db['externalInventory'][asset] = str(amount.quantize(Q))


def _liability_token_total(db: Dict[str, Any], symbols=('SL-CASH','SL-ESCROW','SL-COLL','SL-FEE')) -> Decimal:
    total = Decimal('0')
    for s in symbols:
        total += sum((_d(v) for v in _token_bucket(db, s).values()), Decimal('0'))
    return total.quantize(Q)


def invariants(db: Dict[str, Any] | None = None) -> Dict[str, Any]:
    db = db or _load()
    usdc = _external(db, 'USDC')
    monetary_claims = _liability_token_total(db)
    credit_receivable = sum((_d(v) for v in _token_bucket(db, 'SL-CREDIT').values()), Decimal('0'))
    agent_limits = sum((_d(v) for v in _token_bucket(db, 'SL-AGENT').values()), Decimal('0'))
    positions = sum((_d(v) for v in _token_bucket(db, 'SL-POS').values()), Decimal('0'))
    baskets = sum((_d(v) for v in _token_bucket(db, 'SL-BASKET').values()), Decimal('0'))
    journal_balanced = all(sum((_d(e['debit']) for e in j['entries']), Decimal('0')) == sum((_d(e['credit']) for e in j['entries']), Decimal('0')) for j in db['journal'])
    return {
        'externalUSDC': float(usdc),
        'monetaryClaimsUSDC': float(monetary_claims),
        'cashCoverageRatio': float(usdc / monetary_claims) if monetary_claims > 0 else None,
        'fullyBackedMonetaryClaims': usdc >= monetary_claims,
        'fundedCreditReceivableUSDC': float(credit_receivable),
        'agentBudgetCapacityUSDC': float(agent_limits),
        'positionUnits': float(positions),
        'basketUnits': float(baskets),
        'journalBalanced': journal_balanced,
        'receiptHead': db['receiptHead'],
        'sequence': db['sequence'],
    }


def registry():
    return {'version':'V2','internal': TOKEN_REGISTRY, 'token2022': V2_TOKEN_2022_BLUEPRINTS}


def financial_digest(subject: str):
    """Machine-readable financial state for humans and agents.

    It deliberately separates monetary claims from capabilities/positions so an
    agent cannot mistake a spend limit or market share for cash.
    """
    db=_load()
    def exact(symbol, holder): return float(_token_get(db,symbol,holder))
    positions={k:float(v) for k,v in _token_bucket(db,'SL-POS').items() if k.endswith(':'+subject) and _d(v)>0}
    baskets={k:float(v) for k,v in _token_bucket(db,'SL-BASKET').items() if k.endswith(':'+subject) and _d(v)>0}
    collateral={k:float(v) for k,v in _token_bucket(db,'SL-COLL').items() if k.endswith(':'+subject) and _d(v)>0}
    credit={k:float(v) for k,v in _token_bucket(db,'SL-CREDIT').items() if subject in k and _d(v)>0}
    cash=exact('SL-CASH',subject)
    allowance=exact('SL-AGENT',subject)
    inv=invariants(db)
    return {
        'subject':subject,
        'schema':'StocklanaFinancialDigest/v2',
        'monetary':{'availableUSDC':cash,'fullyBackedSystem':inv['fullyBackedMonetaryClaims'],'coverageRatio':inv['cashCoverageRatio']},
        'capabilities':{'agentBudgetLimitUSDC':allowance,'isMoney':False},
        'collateral':collateral,
        'creditReceivables':credit,
        'positions':positions,
        'baskets':baskets,
        'provenance':{'receiptHead':db['receiptHead'],'sequence':db['sequence']},
        'actionHints':{
            'canSpend':cash>0,
            'canTrade':cash>0,
            'hasCollateral':bool(collateral),
            'hasPositions':bool(positions),
            'hasBasketShares':bool(baskets)
        }
    }


def snapshot():
    db = _load()
    return {'registry': registry(), 'invariants': invariants(db), 'tokenBalances': db['tokenBalances'], 'accounts': db['accounts'], 'journalTail': db['journal'][-50:]}


def reset_for_test():
    with LOCK:
        _save(_default())


def digest(event: Dict[str, Any]):
    """Digest a finance event into double-entry accounting + typed token state."""
    kind = str(event.get('type','')).upper()
    with LOCK:
        db = _load()
        event_id=str(event.get('eventId') or '').strip()
        if event_id and event_id in db.get('processedEvents',{}):
            return {'duplicate':True,'eventId':event_id,'prior':db['processedEvents'][event_id],'invariants':invariants(db),'receiptHead':db['receiptHead']}
        if kind == 'DEPOSIT_USDC':
            user, amount = event['user'], _d(event['amount'])
            if amount <= 0: raise ValueError('invalid_amount')
            _set_external(db, 'USDC', _external(db,'USDC') + amount)
            _move_token(db, 'SL-CASH', None, user, amount)
            j = _post(db, kind, [
                {'account':'ASSET:USDC:VAULT','debit':amount},
                {'account':f'LIABILITY:USER:{user}:CASH','credit':amount},
            ], event)

        elif kind == 'WITHDRAW_USDC':
            user, amount = event['user'], _d(event['amount'])
            _move_token(db, 'SL-CASH', user, None, amount)
            if _external(db,'USDC') < amount: raise ValueError('insufficient_external_inventory')
            _set_external(db, 'USDC', _external(db,'USDC') - amount)
            j = _post(db, kind, [
                {'account':f'LIABILITY:USER:{user}:CASH','debit':amount},
                {'account':'ASSET:USDC:VAULT','credit':amount},
            ], event)

        elif kind == 'INTERNAL_TRANSFER':
            sender, recipient, amount = event['sender'], event['recipient'], _d(event['amount'])
            _move_token(db,'SL-CASH',sender,recipient,amount)
            j=_post(db,kind,[
                {'account':f'LIABILITY:USER:{sender}:CASH','debit':amount},
                {'account':f'LIABILITY:USER:{recipient}:CASH','credit':amount},
            ],event)

        elif kind == 'FEE_PAYMENT':
            user, amount = event['user'], _d(event['amount'])
            _move_token(db,'SL-CASH',user,None,amount); _move_token(db,'SL-FEE',None,'TREASURY',amount)
            j=_post(db,kind,[
                {'account':f'LIABILITY:USER:{user}:CASH','debit':amount},
                {'account':'EQUITY:PROTOCOL:FEES','credit':amount},
            ],event)

        elif kind == 'MARKET_LOCK':
            user, market, amount = event['user'], event['marketId'], _d(event['amount'])
            _move_token(db,'SL-CASH',user,None,amount); _move_token(db,'SL-ESCROW',None,f'{market}:POOL',amount)
            j = _post(db, kind, [
                {'account':f'LIABILITY:USER:{user}:CASH','debit':amount},
                {'account':f'LIABILITY:MARKET:{market}:ESCROW','credit':amount},
            ], event)

        elif kind == 'MARKET_PAYOUT':
            user, market, amount = event['user'], event['marketId'], _d(event['amount'])
            holder = event.get('escrowHolder') or f'{market}:POOL'
            _move_token(db,'SL-ESCROW',holder,None,amount); _move_token(db,'SL-CASH',None,user,amount)
            j = _post(db, kind, [
                {'account':f'LIABILITY:MARKET:{market}:ESCROW','debit':amount},
                {'account':f'LIABILITY:USER:{user}:CASH','credit':amount},
            ], event)

        elif kind == 'MARKET_POOL_LOCK':
            market, amount = event['marketId'], _d(event['amount'])
            source = event['user']
            _move_token(db,'SL-CASH',source,None,amount); _move_token(db,'SL-ESCROW',None,f'{market}:POOL',amount)
            j = _post(db, kind, [
                {'account':f'LIABILITY:USER:{source}:CASH','debit':amount},
                {'account':f'LIABILITY:MARKET:{market}:ESCROW','credit':amount},
            ], event)

        elif kind == 'FEE_CAPTURE':
            market, amount = event['marketId'], _d(event['amount'])
            holder = event.get('escrowHolder', f'{market}:POOL')
            _move_token(db,'SL-ESCROW',holder,None,amount); _move_token(db,'SL-FEE',None,'TREASURY',amount)
            j = _post(db, kind, [
                {'account':f'LIABILITY:MARKET:{market}:ESCROW','debit':amount},
                {'account':'EQUITY:PROTOCOL:FEES','credit':amount},
            ], event)

        elif kind == 'COLLATERAL_LOCK':
            user, key, amount = event['user'], event['collateralId'], _d(event['amount'])
            _move_token(db,'SL-CASH',user,None,amount); _move_token(db,'SL-COLL',None,f'{key}:{user}',amount)
            j = _post(db, kind, [
                {'account':f'LIABILITY:USER:{user}:CASH','debit':amount},
                {'account':f'LIABILITY:COLLATERAL:{key}','credit':amount},
            ], event)

        elif kind == 'COLLATERAL_UNLOCK':
            user, key, amount = event['user'], event['collateralId'], _d(event['amount'])
            _move_token(db,'SL-COLL',f'{key}:{user}',None,amount); _move_token(db,'SL-CASH',None,user,amount)
            j = _post(db, kind, [
                {'account':f'LIABILITY:COLLATERAL:{key}','debit':amount},
                {'account':f'LIABILITY:USER:{user}:CASH','credit':amount},
            ], event)

        elif kind == 'AGENT_BUDGET_SET':
            agent, amount = event['agentId'], _d(event['amount'])
            old=_token_get(db,'SL-AGENT',agent); _token_set(db,'SL-AGENT',agent,amount)
            delta=amount-old
            # Capability only. Memo accounts preserve auditability without affecting monetary balance sheet.
            if delta >= 0:
                entries=[{'account':f'MEMO:AGENT:{agent}:ALLOWANCE','debit':delta},{'account':'MEMO:AGENT:ALLOWANCE:CONTROL','credit':delta}]
            else:
                x=-delta; entries=[{'account':'MEMO:AGENT:ALLOWANCE:CONTROL','debit':x},{'account':f'MEMO:AGENT:{agent}:ALLOWANCE','credit':x}]
            j=_post(db,kind,entries,event)

        elif kind == 'CREDIT_DRAW':
            user, loan, amount = event['user'], event['loanId'], _d(event['amount'])
            pool = event.get('pool','LENDER_POOL')
            # Fully funded credit: the pool transfers an existing cash claim to the borrower.
            # No new money is created. The pool receives the SL-CREDIT receivable claim.
            _move_token(db,'SL-CASH',pool,user,amount); _move_token(db,'SL-CREDIT',None,f'{loan}:{pool}',amount)
            j=_post(db,kind,[
                {'account':f'LIABILITY:POOL:{pool}:CASH','debit':amount},
                {'account':f'LIABILITY:USER:{user}:CASH','credit':amount},
                {'account':f'MEMO:CREDIT:{loan}:RECEIVABLE','debit':amount},
                {'account':'MEMO:CREDIT:CONTROL','credit':amount},
            ],event)

        elif kind == 'CREDIT_REPAY':
            user, loan, amount = event['user'], event['loanId'], _d(event['amount'])
            pool = event.get('pool','LENDER_POOL')
            _move_token(db,'SL-CASH',user,pool,amount); _move_token(db,'SL-CREDIT',f'{loan}:{pool}',None,amount)
            j=_post(db,kind,[
                {'account':f'LIABILITY:USER:{user}:CASH','debit':amount},
                {'account':f'LIABILITY:POOL:{pool}:CASH','credit':amount},
                {'account':'MEMO:CREDIT:CONTROL','debit':amount},
                {'account':f'MEMO:CREDIT:{loan}:RECEIVABLE','credit':amount},
            ],event)

        elif kind == 'POSITION_MINT':
            holder, amount = event['holder'], _d(event['units'])
            pos=f"{event['marketId']}:{event['side'].upper()}:{holder}"
            _move_token(db,'SL-POS',None,pos,amount)
            j=_post(db,kind,[{'account':f'MEMO:POSITION:{pos}','debit':amount},{'account':'MEMO:POSITION:CONTROL','credit':amount}],event)

        elif kind == 'POSITION_TRANSFER':
            market, side, sender, recipient, amount = event['marketId'],event['side'].upper(),event['sender'],event['recipient'],_d(event['units'])
            _move_token(db,'SL-POS',f'{market}:{side}:{sender}',f'{market}:{side}:{recipient}',amount)
            j=_post(db,kind,[{'account':f'MEMO:POSITION:{market}:{side}:{recipient}','debit':amount},{'account':f'MEMO:POSITION:{market}:{side}:{sender}','credit':amount}],event)

        elif kind == 'POSITION_BURN':
            holder, amount = event['holder'], _d(event['units'])
            pos=f"{event['marketId']}:{event['side'].upper()}:{holder}"
            _move_token(db,'SL-POS',pos,None,amount)
            j=_post(db,kind,[{'account':'MEMO:POSITION:CONTROL','debit':amount},{'account':f'MEMO:POSITION:{pos}','credit':amount}],event)

        elif kind == 'BASKET_ISSUE':
            holder, basket, units = event['holder'], event['basketId'], _d(event['units'])
            _move_token(db,'SL-BASKET',None,f'{basket}:{holder}',units)
            j=_post(db,kind,[{'account':f'MEMO:BASKET:{basket}:{holder}','debit':units},{'account':f'MEMO:BASKET:{basket}:INVENTORY','credit':units}],event)

        elif kind == 'BASKET_REDEEM':
            holder, basket, units = event['holder'], event['basketId'], _d(event['units'])
            _move_token(db,'SL-BASKET',f'{basket}:{holder}',None,units)
            j=_post(db,kind,[{'account':f'MEMO:BASKET:{basket}:INVENTORY','debit':units},{'account':f'MEMO:BASKET:{basket}:{holder}','credit':units}],event)

        else:
            raise ValueError('unsupported_finance_event')

        inv=invariants(db)
        if not inv['journalBalanced']:
            raise ValueError('journal_invariant_failed')
        if not inv['fullyBackedMonetaryClaims']:
            raise ValueError('monetary_backing_invariant_failed')
        if event_id:
            db.setdefault('processedEvents',{})[event_id]={'sequence':j['sequence'],'commitment':j['commitment'],'type':kind}
            if len(db['processedEvents'])>10000:
                for k in list(db['processedEvents'])[:-10000]: db['processedEvents'].pop(k,None)
        _save(db)
        return {'journal': j, 'invariants': inv, 'receiptHead': db['receiptHead'], 'eventId': event_id or None}


def seed_lender_pool(amount: Any = 100000):
    """Fund a lender pool from real/external USDC inventory for tests/operator setup."""
    with LOCK:
        db=_load(); x=_d(amount)
        if x <= 0: raise ValueError('invalid_amount')
        _set_external(db,'USDC',_external(db,'USDC')+x)
        _move_token(db,'SL-CASH',None,'LENDER_POOL',x)
        j=_post(db,'LENDER_POOL_FUND',[{'account':'ASSET:USDC:VAULT','debit':x},{'account':'LIABILITY:POOL:LENDER_POOL:CASH','credit':x}],{'amount':str(x)})
        _save(db); return {'journal':j,'invariants':invariants(db)}
