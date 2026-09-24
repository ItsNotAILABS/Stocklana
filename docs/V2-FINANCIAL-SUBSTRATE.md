# Stocklana V2 Financial Substrate

V2 is the only user-facing financial token standard. The internal double-entry grammar remains the source of truth; Token-2022 is used where programmable public claims improve the product. No monetary claim is created without backing.

## Token classes

- `SL-CASH` — internal 1:1 settlement receipt; kept off-chain until an issuer/compliance model supports a bearer claim.
- `SL-ESCROW` — Token-2022 non-transferable market escrow proof.
- `SL-COLL` — Token-2022 non-transferable collateral state.
- `SL-FEE` — internal treasury accrual.
- `SL-CREDIT` — Token-2022 funded-credit receivable marker.
- `SL-AGENT` — Token-2022 non-transferable agent authority/capability; never money.
- `SL-POS` — Token-2022 position receipt with transfer hook policy.
- `SL-BASKET` — Token-2022 basket receipt with transfer hook policy.

## User rule

Users never need to understand these symbols to use the app. They see Buy, Auto-invest, Borrow, Play, Send, Spend, Agent and Launch. V2 tokens are the machine-readable accounting/programmability layer underneath those actions.
