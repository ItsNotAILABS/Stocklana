# Stocklana Wallet Workspace

The connected Solana wallet is now a first-class Stocklana surface. Phantom remains the signing boundary; Stocklana reads public wallet state and builds actions while private keys never enter the app.

## User-visible wallet state
- SOL balance
- USDC balance
- detected PreStocks token balances
- Stocklana vault balance
- authenticated wallet address/session state
- direct routes to buy PreStocks, deposit USDC, send, play markets, use credit, and fund policy-scoped agents

## Architecture
`src/solana-client.js` reads classic SPL and Token-2022 accounts from Solana RPC. `src/app.js` maps eligible token mints against the existing PreStocks registry and renders holdings inside the web app. All transactions continue to be signed by the connected wallet provider.
