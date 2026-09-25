from pathlib import Path
root=Path(__file__).resolve().parents[1]
js=(root/'src/pons-v2.js').read_text(encoding='utf-8'); app=(root/'src/app.js').read_text(encoding='utf-8'); html=(root/'index.html').read_text(encoding='utf-8'); css=(root/'src/styles.css').read_text(encoding='utf-8')
checks={
 'factory': '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' in js,
 'chain': 'CHAIN_ID=4663' in js,
 'rpc': 'rpc.mainnet.chain.robinhood.com' in js,
 'wallet_switch': 'wallet_switchEthereumChain' in js,
 'wallet_add': 'wallet_addEthereumChain' in js,
 'factory_configs': 'launchConfigCount' in js and 'getLaunchConfig' in js,
 'economics_pin': 'previewLaunchEconomics' in js,
 'launch_fee': 'launchFee' in js,
 'launch_write': "functionName:'launchToken'" in js,
 'wait_receipt': 'waitForTransactionReceipt' in js,
 'event_parse': "eventName:'TokenLaunched'" in js,
 'import_read': 'getLaunchedToken' in js,
 'curve_reserves': 'getReserves' in js,
 'curve_progress': 'realQuoteReserve' in js and 'graduationThreshold' in js,
 'buy_quote': 'currentSnipeTaxBps' in js and 'sellableTokens' in js,
 'buy_exec': "functionName:'buy'" in js,
 'sell_approve': "functionName:'approve'" in js,
 'sell_exec': "functionName:'sell'" in js,
 'eth_pair': "pairSymbol:launch.pairToken===ZERO?'ETH'" in js,
 'no_private_key': 'privateKey' not in js and 'mnemonic' not in js,
 'launch_tabs': all(x in html for x in ['data-launch-tab="portfolio"','data-launch-tab="create"','data-launch-tab="import"']),
 'create_form': all(x in html for x in ['ponsName','ponsSymbol','ponsCreatorTax','ponsBuyback','ponsLaunchBtn']),
 'import_form': 'ponsImportAddress' in html and 'ponsImportBtn' in html,
 'live_cards': 'ponsLaunchGrid' in html,
 'app_wired': all(x in app for x in ['launchPonsV2','readPonsLaunch','buyPons','sellPons']),
 'persist_import': 'localStorage' in app and 'stocklana:pons:v2:tracked' in app,
 'responsive': '@media(max-width:649px)' in css and '.launch-terminal' in css,
}
failed=[k for k,v in checks.items() if not v]
if failed: raise SystemExit('FAIL '+','.join(failed))
print(f"PASS {len(checks)}/{len(checks)} Pons/Robinhood launch assertions")
