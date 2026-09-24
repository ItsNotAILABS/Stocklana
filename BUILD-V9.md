# Stocklana v9 — V2 Financial Token Substrate

## What changed

Stocklana now has one internal financial grammar and two Solana token profiles.

### Internal accounting grammar

`src/accounting_tokens.py` is an event-sourced double-entry digest engine for:

- `SL-CASH` — 1:1 internal USDC settlement receipt;
- `SL-ESCROW` — segregated market collateral;
- `SL-COLL` — locked collateral receipt;
- `SL-FEE` — protocol fee accrual;
- `SL-CREDIT` — funded credit receivable;
- `SL-AGENT` — non-monetary AI spending capability;
- `SL-POS` — market-position claim;
- `SL-BASKET` — basket/robo portfolio claim.

Every supported event produces balanced postings, a BLAKE2b receipt-chain commitment and a machine-readable financial digest. External event IDs are idempotent so a Solana signature cannot mint internal value twice.

### V1 — compatibility-first

V2 wallet-signed Token-2022 builders are the only user-facing issuance path.

### V2 — programmable

`src/token2022-accounting.js` builds wallet-signed Token-2022 mint transactions:

- escrow / collateral / credit / agent receipts: MetadataPointer + NonTransferable;
- position / basket receipts: MetadataPointer + TransferHook.

Stocklana intentionally keeps cash and treasury fee accounting internal instead of manufacturing another freely transferable cash-like token.

## AI-native digest

`GET /api/accounting/me` returns `StocklanaFinancialDigest/v2`: spendable cash, capabilities, collateral, credit claims, positions, basket shares, provenance and action hints. Agent budgets are explicitly marked `isMoney: false`.

## Proof

- 494 dedicated accounting-token assertions PASS.
- 24 Solana V2 token-profile assertions PASS.
- 17 Tokenized Equities track-fit assertions PASS.
- 1,343 full acceptance assertions PASS.
- HTTP market/vault/position/redemption lifecycle PASS.
- Browser/static API certification PASS with 9 systems.

## External execution boundary

The accounting/digest engine is executable locally today. V2 on-chain mint creation requires the connected Solana wallet to sign and pay the real network transaction. This package does not invent mint addresses or signatures.