import hashlib, json

def _id(mint):
    return 'pso_'+hashlib.blake2b(str(mint).encode(),digest_size=12,person=b'STOCKLANA-OBJ').hexdigest()

def compile_object(asset,templates):
    symbol=asset['symbol'];mint=asset.get('contract_address') or asset.get('mint')
    related=[t for t in templates if t.get('underlyingMint')==mint or t.get('symbol')==symbol]
    fam={}
    for t in related: fam[t.get('family','market')]=fam.get(t.get('family','market'),0)+1
    actions=[
      {'id':'TRADE','status':'EXECUTABLE_WITH_WALLET','rail':'JUPITER_SWAP_V2','orderEndpoint':'/api/prestocks/order','executeEndpoint':'/api/prestocks/execute','signer':'CONNECTED_SOLANA_WALLET'},
      {'id':'CONVERT','status':'EXECUTABLE_WITH_WALLET','rail':'JUPITER_SWAP_V2','orderEndpoint':'/api/swap/order','executeEndpoint':'/api/swap/execute','allowedSettlement':['USDC','SOL','PRESTOCKS_ONLY']},
      {'id':'PLAY','status':'EXECUTABLE','discoverEndpoint':'/api/games','tradeEndpoint':'/api/markets/:id/trade','chainTradeEndpoint':'/api/markets/:id/trade-chain','challengeEndpoint':'/api/challenges','challengeMode':'ISOLATED_HEAD_TO_HEAD','families':fam},
      {'id':'SPEND','status':'EXECUTABLE_TO_ISSUER_BOUNDARY','intentEndpoint':'/api/commerce/intents','fundEndpoint':'/api/commerce/fund-wallet','sourceAsset':symbol,'conversion':'PRESTOCK_TO_USDC','merchantBound':True,'subscriptionsDefault':'BLOCKED'},
      {'id':'AUTOMATE','status':'EXECUTABLE_PLAN','recurringEndpoint':'/api/equity/recurring','basketEndpoint':'/api/equity/basket','executionRail':'JUPITER_SWAP_V2'},
      {'id':'DELEGATE','status':'EXECUTABLE_POLICY','agentEndpoint':'/api/agent-vaults','policyEndpoint':'/api/agent-vaults/policy','capabilityEndpoint':'/api/auth/agent','walletKeyDelegated':False},
      {'id':'CREDIT','status':'ROUTE_DEPENDENT','internalQuoteEndpoint':'/api/lending/quote','defiAdapterEndpoint':'/api/kamino','note':'Direct PreStock collateral depends on the selected lending venue accepting this mint; Stocklana does not claim unsupported collateral.'},
      {'id':'PROVE','status':'EXECUTABLE','receiptsEndpoint':'/api/receipts','accountingEndpoint':'/api/accounting/me','proofRoomEndpoint':'/api/proofroom'}
    ]
    return {
      'objectVersion':'StocklanaPreStockObject/v1','objectId':_id(mint),
      'issuerLane':'PRESTOCKS_ONLY','symbol':symbol,'name':asset.get('name'),'mint':mint,
      'tokenPrice':asset.get('tokenPrice'),'markPrice':asset.get('markPrice'),
      'impliedValuation':asset.get('impliedValuation'),'markValuation':asset.get('markValuation'),
      'capabilityCount':len(actions),'actions':actions,
      'guardrails':{'nonPreStocksPreIPOAllowed':False,'privateKeyCustody':False,'investmentAutoSale':False,'externalReceiptRequiredForExternalCompletion':True}
    }

def compile_all(assets,templates):
    return [compile_object(a,templates) for a in assets]

def capabilities():
    return {'schema':'StocklanaPreStockObject/v1','purpose':'machine-readable action graph for eligible PreStocks','actions':['TRADE','CONVERT','PLAY','SPEND','AUTOMATE','DELEGATE','CREDIT','PROVE']}
