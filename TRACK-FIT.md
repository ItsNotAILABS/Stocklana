# Stocklana — Tokenized Equities Track Fit

## The wedge

**Stocklana makes a tokenized equity useful after you buy it.**

A brokerage app mostly lets a user buy, hold and sell. Stocklana treats a tokenized equity as a programmable Solana asset that can be acquired 24/7, scheduled, combined into baskets, governed by an AI agent, used in a fully collateralized market, routed into supported credit venues, transferred socially, and used as the source of portfolio spending.

The product is deliberately one wedge: **programmable tokenized-equity ownership**. The 360-instrument market factory, Stocklana Vault, Agent Vaults, MAQUE and Phantasma are infrastructure behind that wedge, not separate pitches.

## What the source asks for → what the build does

### Trading
The private-equity lane uses PreStocks; the public-equity adapter is isolated for xStocks/Backed data and issuer-specific rules.

1. **24/7 tokenized-equity swaps** — the PreStock asset action builds Jupiter Swap V2 orders for the exact SPL mint and supports wallet-signed execution. USDC is the settlement asset.
2. **Programmable equity markets** — 360 fully collateralized instruments let users express simple price, valuation, relative-value, basket and downside views without Stocklana taking the opposite side.

### Investing
1. **Recurring buys** — `src/equity_os.py` persists daily/weekly/monthly recurring-buy plans and emits the next Jupiter execution action.
2. **Index baskets + robo portfolios** — weighted multi-equity baskets compile into per-mint Jupiter orders; policy-scoped robo allocations support conservative/balanced/growth portfolios.

### Credit and yield
1. **Tokenized-equity collateral** — `src/kamino_adapter.py` builds real Kamino unsigned deposit/borrow transactions through `api.kamino.finance`; the user's wallet signs locally. A stock can only be routed when a live Kamino reserve for that mint exists.
2. **Credit + corporate action layer** — Stocklana's funded lending pool never creates money; the equity OS also records issuer/provider corporate actions so dividends, splits or similar events can feed automation and accounting rather than being ignored.

### Infrastructure
1. **Observation and settlement** — PreStocks observations feed the private-equity lane; Pyth is used where a relevant Pyth feed exists; automatic settlement never uses the fallback UI snapshot for money-bearing resolution.
2. **V1/V2 financial substrate** — a double-entry financial-token grammar compiles deposits, escrow, collateral, fees, funded credit, agent budgets, positions and baskets into typed claims. V1 uses classic SPL receipts for compatibility; V2 uses Token-2022 non-transferability / transfer hooks where policy should travel with the asset.
3. **Operations** — wallet-authenticated sessions, per-market solvency, corporate-action registry, Phantasma PQ receipts, reconstructible ledger and ISO 20022 translation.

### Consumer
1. **Investing interface** — responsive mobile plus laptop workstation, human-readable asset actions, recurring plans, baskets and social/copy signals.
2. **Spend from portfolio** — MAQUE internal payments, Solana payment requests and one-use card policies make portfolio value usable without forcing the user through a brokerage-style sell/withdraw/redeposit workflow.

## Why Solana

This product only makes sense when the equity is a programmable token. Stocklana deliberately ships **both** Solana modes: V1 classic SPL receipts maximize compatibility with the existing ecosystem, while V2 Token-2022 receipts add policy semantics such as non-transferability and transfer hooks to escrow, collateral, agent, position and basket claims. The same account can therefore use today's DeFi rails without giving up a path to richer programmable-asset controls.

## Track proof gate

`python3 scripts/test_track_fit.py` verifies the source-aligned wedge, at least two implemented surfaces in every judging category, recurring buys, basket compilation, robo allocation, corporate actions and the Kamino transaction-builder boundary. `python3 scripts/test_accounting_tokens.py` independently runs 494 assertions over the V1/V2 financial substrate.
