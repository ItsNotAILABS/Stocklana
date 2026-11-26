# Stocklana Money App North Star

## Product sentence

**Stocklana is a money app that lets one wallet balance do more: send, pay, grow, borrow, play, and fund an AI.**

The product should not feel like a trading terminal. Markets, Solana programs, AMMs, token routes, collateral engines, and settlement systems are implementation rails. They appear only when they help a user make a decision, review risk, or verify a receipt.

## Home screen contract

A user should understand three things within seconds:

1. **How much money do I have?**
2. **What can I do with it?**
3. **What happened recently?**

The default home hierarchy is therefore:

- total usable money;
- six primary actions: **Send · Pay · Grow · Borrow · Play · AI**;
- cash / SOL / investment composition;
- recent activity;
- useful opportunities, not market-terminal noise.

## Product language

| Internal / protocol language | Consumer surface |
|---|---|
| Wallet / vault balances | Your Money |
| Swap | Convert |
| PreStocks trading | Grow |
| MAQUE commerce | Pay |
| Prediction market / pm-AMM | Play |
| DeFi credit | Borrow |
| Agent Vault | AI Budget |
| Ledger / transaction log | Activity |
| Settlement / explorer | Receipt / Details |

Technical terms remain available in Details, Advanced, and receipt surfaces.

## Money object model

The user should think in terms of **money they can use**, not separate crypto products.

### Cash
USDC and other approved cash-equivalent balances. Primary source for send/pay/play/AI.

### Network money
SOL or other gas/native balances. Visible, but not treated as the main consumer balance unless useful.

### Investments
PreStocks and other explicitly supported investment assets. These can be bought, sold, automated, used for supported collateral routes, or intentionally converted for payments.

### Credit
Borrowing power backed by supported assets or funded pools. Never merged into cash balance until actually drawn.

### AI budget
A bounded allocation of the user's money. The AI receives permission to act inside rules, not ownership of the wallet.

## Action model

Every primary action follows the same interaction grammar:

**Intent → amount → source → preview → approve → execute → receipt**

Examples:

- Send: person/wallet → amount → source → preview → wallet approval → receipt
- Pay: merchant → amount → source → rules → approval → payment receipt
- Grow: company → amount → route → price preview → approval → asset receipt
- Borrow: collateral → amount → terms → approval → funded credit receipt
- Play: question → side → stake → payoff/max loss → approval → market receipt
- AI: task/budget → limits → allowed actions → approval → durable agent receipt

This grammar is more important than any individual protocol integration because it keeps the app coherent as new rails are added.

## Navigation

Primary:
- Home
- Money
- Grow
- Send
- Pay
- Play
- AI
- Activity

Advanced:
- Borrow / Credit
- Market Lab
- Launch
- Infrastructure
- Proof
- CMESH

CMESH remains separate from PreStocks.

## UX rules

- Show dollars and plain-language outcomes before token units.
- Never lead with chain, program, venue, or AMM names.
- Keep signing local and explicit.
- Show maximum loss before risk-taking actions.
- Show fees and conversion impact before approval.
- Show protocol and chain details in an expandable receipt.
- Never fabricate balances, fills, signatures, or success states.
- If a route is unavailable, say so directly and preserve the user's funds.
- Do not force users to understand Solana to complete ordinary money tasks.

## Product architecture direction

The long-term surface becomes a money operating layer over several execution systems:

- **Money** — wallet + account + conversion
- **Grow** — PreStocks, recurring buys, portfolios
- **Send / Pay** — MAQUE, Solana payments, card/merchant adapters
- **Borrow** — funded Stocklana credit + approved external DeFi
- **Play** — PREDICT pm-AMM + Stocklana payoff games
- **AI** — bounded agent budgets and autonomous money workflows
- **Receipts** — one normalized proof format across every rail

The user should be able to move between these without feeling they entered a different product.

## Build order

1. Consumer home and navigation.
2. Unified money balance and source picker.
3. Unified send/pay flow.
4. Grow flow with simple buy/auto/use actions.
5. Borrow power surfaced directly from supported holdings.
6. Play cards that hide market mechanics until Details.
7. AI budget creation from the same money source picker.
8. Unified activity and receipts.
9. Natural-language command layer: “send $25 to…”, “buy $50 of…”, “give my AI $100 this week”.
10. Advanced rails remain available for power users and competition proof.

## Success test

A new user should be able to use Stocklana without knowing what a token mint, AMM, PDA, RPC, oracle, or settlement program is.

A technical user should still be able to inspect every one of those details after the action.
