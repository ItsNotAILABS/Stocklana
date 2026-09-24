# Stocklana — Solana Tokenized Equities Submission

**Submission deadline:** Friday, September 25, 2026 at 4:00 PM ET  
**Wedge:** **Stocklana V2 — programmable tokenized-equity ownership that users can immediately buy, automate, collateralize, play, send, spend, delegate to agents and launch around.**

## Could this be a real app people actually use?

Stocklana starts from a simple problem: tokenized equities can already trade around the clock, but most products still treat them like brokerage holdings with a crypto wrapper.

**Stocklana makes the asset useful after the buy.** A user can acquire a tokenized equity 24/7, automate recurring investing, combine holdings into baskets, create simple fully collateralized payoff markets, route a supported tokenized share into credit, give an AI agent scoped authority to manage it, transfer value socially, and spend from portfolio value through MAQUE/Solana payment/card rails.

The product is one coherent account fabric rather than a collection of demos.

## 90-second judge path

1. **Equity Desk** — open a live tokenized-equity asset and choose **Buy / sell 24/7**. Stocklana builds the Jupiter Swap V2 action for the exact SPL mint.
2. Choose **Schedule recurring buy**. The plan is persisted as a real daily/weekly/monthly investment instruction.
3. **Instrument Forge** — turn the same equity into a simple collateralized price/value/relative/basket payoff. Stocklana does not take the other side.
4. **Vault & MAQUE** — move funds between CASH/TRADING/RESERVE, send a friend value, generate a Solana payment request, or create a one-use spend policy.
5. **Positions** — transfer a market position to another participant.
6. **Agent Network** — inspect policy-scoped Agent Vaults. The same account, market and payment code is used by human and AI identities.
7. **Infrastructure** — inspect solvency, automatic settlement, Phantasma PQ proofs, ISO 20022 translation and external execution boundaries.
8. **Track Fit** — see the exact contest categories mapped to implemented surfaces.

## Exact track alignment

### Tokenized Equities — round-the-clock assets
PreStocks is the live private-equity universe in this submission. The execution layer is mint-specific and Solana-native. The architecture also isolates a public tokenized-equity adapter (`src/xstocks_adapter.py`) for xStocks/Backed product and price data, so broader Solana equity rails can coexist without contaminating the PreStocks eligibility lane.

### DeFi integration
- `src/kamino_adapter.py` calls Kamino's transaction API to build unsigned collateral-deposit and borrow transactions. The user's wallet signs locally.
- `src/lending.py` supplies a fully funded internal credit rail for Stocklana-native collateral workflows; it cannot create money.

A token is only routed to Kamino when a real Kamino market/reserve supports that asset. Stocklana does not fabricate reserve support.

### V2 Solana financial substrate
- **V2:** Token-2022 escrow, collateral, credit, agent, position and basket receipts with selective metadata, non-transferability and transfer-hook policy.
- **Internal accounting:** eight typed financial claims/capabilities compile from verified events into a double-entry ledger. A dedicated 494-assertion test proves balanced journals, 1:1 monetary backing, funded-credit conservation, agent-budget non-monetary semantics, position/basket lifecycle, and chain-event idempotency.

This is the infrastructure argument for Solana: the same equity account can expose simple SPL compatibility today and more expressive Token-2022 financial semantics where integrations support them.

### Programmable assets
- **360 instruments / 16 families** derived from eligible tokenized-equity observations.
- **15 automatic settlement evaluators.**
- recurring buys, weighted baskets, robo allocations, social/copy signals, corporate-action ingestion and AI Agent Vault policy automation.

## What the track asks for

### Trading
1. Jupiter Swap V2 tokenized-equity ↔ USDC execution.
2. Fully collateralized programmable equity markets with transferable positions.

### Investing
1. Daily/weekly/monthly recurring buys.
2. Weighted baskets and policy-scoped robo portfolios.

### Credit and yield
1. Kamino unsigned transaction construction for supported equity collateral reserves.
2. Pool-funded Stocklana credit plus corporate-action/dividend event ingestion.

### Infrastructure
1. PreStocks observation + Pyth where a relevant feed exists, automatic settlement and per-market solvency analytics.
2. Corporate-action registry, wallet-authenticated identities, Phantasma PQ receipts, reconstructible ledger and ISO 20022 reconciliation.

### Consumer
1. Laptop/mobile equity workstation plus social/copyable thesis signals.
2. MAQUE internal payments, Solana payment requests and one-time spend controls sourced from portfolio value.

## Why this belongs on Solana

This product depends on the equity being a programmable token, not a database row at a brokerage. On Solana the same SPL/Token-2022 asset can move through wallet execution, program escrow, payments, credit and agent policy. Fast low-cost settlement lets investing, DeFi and payments share one account model.

## End-to-end proof

- **360** instruments across **16** families.
- **15** automatic settlement rule families.
- exact eight-mint PreStocks private-equity allowlist.
- fully collateralized pari-mutuel default and segregated market escrow.
- house directional exposure = **0** on exercised markets.
- transferable positions.
- wallet-authenticated humans + scoped AI capabilities.
- **100** Agent Vaults.
- **100 personas × 7 days = 700/700 sessions, 0 failures**.
- **1,343 acceptance assertions PASS** plus **494 accounting-token assertions PASS** after track-specific additions.
- **8/8** workstation navigation surfaces.
- **100/100** ISO 20022 translation stress check.
- hybrid Phantasma PQ proof architecture.

See `TRACK-FIT.md`, `ACCEPTANCE-RESULT-V7.json`, `WEEK-100-REPORT.md`, `REQUIREMENTS-AUDIT.md`, `SECURITY.md` and `public/ledger.csv`.

## On-chain execution boundary

`programs/stocklana-market/` implements the current USDC escrow market source and `src/stocklana-program-client.js` contains matching transaction builders: PreStocks allowlist, PDAs, USDC collateral vault, fee vault, YES/NO pools, transferable positions, time-gated resolution, proof commitment and proportional redemption.

This archive does **not** invent a Program ID or transaction signature. A live Solana deployment requires a funded deployment signer and confirmed chain transaction. The same rule applies to external Jupiter fills, Kamino deposits/borrows, Meteora pools, card issuance and bank settlement: the code path exists, but the external provider/chain receipt is the execution proof.
