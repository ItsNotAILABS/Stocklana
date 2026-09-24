# Stocklana v8 — Launch Exchange

## What changed

The Launch view is now an executable Robinhood Chain / Pons v2 surface rather than a route-picker. It supports:

1. Connect an injected EVM wallet and switch/add Robinhood Chain (4663).
2. Read enabled launch configs and the launch fee from the live Pons v2 factory.
3. Launch a token through `launchToken(...)` with pinned economics, creator tax, socials, optional buybacks and a fresh CREATE2 salt.
4. Wait for the transaction receipt and parse the `TokenLaunched` event before recording the token.
5. Import an existing Pons v2 token by contract address.
6. Read its authoritative phase, creator, pair asset, fees, buyback flag, curve reserves, real quote raised and graduation threshold.
7. Quote native-ETH buys with base fee, creator tax, opening snipe tax and final partial-fill handling.
8. Execute wallet-signed buys and sells against the token's own bonding curve.
9. Open Blockscout proof directly from the token card.
10. Persist tracked launch addresses locally without ever storing private keys.

## Your two ETH-paired tokens

The importer is ready for them. Their full `0x...` contract addresses are required to bind them; the screenshots only expose shortened addresses, so this release does not guess or fabricate the missing bytes.

## Verification

- `python3 scripts/test_pons_surface.py` -> 27/27
- `node --check src/pons-v2.js` -> PASS
- `node --check src/app.js` -> PASS
- HD browser HTTP/API certification -> PASS