# Stocklana V2 — Build V10

## Product shift

V10 turns the existing Stocklana infrastructure into a user-facing product. The landing surface is no longer an infrastructure dashboard. It opens with eight immediate actions: Buy, Auto-invest, Borrow, Play a market, Send, Spend, Agent and Launch.

## UX architecture

- **Home** — account value, immediate actions, discoverable equities, visible use map.
- **Invest** — direct Buy / Auto / More controls on every equity.
- **Markets** — 360 programmable financial games/instruments.
- **Money** — Vault, MAQUE, one-use card policy, transfers, offline intents.
- **Credit** — funded Stocklana credit and Kamino transaction builder.
- **Agent** — 100 Agent Vaults with scoped financial authority.
- **Launch** — embedded ETH/Solana launch rails.
- **System** — accounting, Token-2022, ISO 20022, settlement and PQ proof.

## Fully V2 token standard

The product-facing V1 SPL issuance path has been removed. `src/accounting_tokens.py` now reports V2 semantics for all eight internal token classes and `src/token2022-accounting.js` is the only programmable mint builder. `SL-CASH` and `SL-FEE` remain internal accounting claims; the six public programmable classes use Token-2022 purpose-specific profiles.

## Proof

- V2 UX: 145/145
- Core acceptance: 1,342
- Accounting: 494
- Token-2022 profile checks: 19
- HTTP/API market + vault + transfer + redeem lifecycle: PASS
- Static browser/API certification: PASS