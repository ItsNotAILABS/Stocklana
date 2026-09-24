import math

def _num(x):
    try: return max(0.0,float(x or 0))
    except Exception: return 0.0

def purchase_plan(amount_usdc,wallet_usdc=0,vault_usdc=0,sol_balance=0,prestocks=None):
    amount=_num(amount_usdc)
    if amount<=0: raise ValueError('invalid_amount')
    wallet=_num(wallet_usdc); vault=_num(vault_usdc); sol=_num(sol_balance)
    holdings=prestocks or []
    routes=[]
    if wallet+1e-9>=amount:
        routes.append({'id':'WALLET_USDC','label':'Pay from Phantom USDC','transformations':0,'walletUSDC':amount,'vaultUSDC':0,'ready':True})
    if vault+1e-9>=amount:
        routes.append({'id':'STOCKLANA_USDC','label':'Pay from Stocklana balance','transformations':0,'walletUSDC':0,'vaultUSDC':amount,'ready':True})
    if wallet>0 and vault>0 and wallet+vault+1e-9>=amount:
        from_vault=min(vault,amount); from_wallet=max(0.0,amount-from_vault)
        routes.append({'id':'SPLIT_USDC','label':'Split Phantom + Stocklana','transformations':1,'walletUSDC':round(from_wallet,6),'vaultUSDC':round(from_vault,6),'ready':True})
    if sol>0:
        routes.append({'id':'SOL_TO_USDC','label':'Convert SOL, then pay','transformations':1,'solBalance':sol,'needsLiveQuote':True,'ready':False})
    for h in holdings:
        value=_num(h.get('estimatedValueUSDC'))
        price=_num(h.get('tokenPrice'))
        balance=_num(h.get('amount'))
        if value<=0 or price<=0 or balance<=0: continue
        # 3% estimate buffer is shown to the user; actual Jupiter route is wallet-signed.
        est=min(balance,(amount/price)*1.03)
        routes.append({
            'id':'PRESTOCK_TO_USDC','label':f"Use {h.get('symbol','PreStock')} for this purchase",
            'transformations':2,'symbol':h.get('symbol'),'mint':h.get('mint'),
            'tokenBalance':balance,'estimatedValueUSDC':value,'estimatedTokensToSell':round(est,8),
            'estimatedCoverageUSDC':round(est*price,6),'canCoverEstimate':value+1e-9>=amount,
            'needsLiveQuote':True,'ready':False
        })
    routes.sort(key=lambda x:(x.get('transformations',99),0 if x.get('ready') else 1,-x.get('estimatedValueUSDC',0)))
    default=next((x['id'] for x in routes if x.get('ready')),routes[0]['id'] if routes else None)
    return {
        'amountUSDC':amount,'walletUSDC':wallet,'vaultUSDC':vault,'solBalance':sol,
        'routes':routes,'defaultRoute':default,
        'principles':['never auto-sell an investment','wallet keys stay local','merchant purchase funds are reserved before card issuance']
    }
