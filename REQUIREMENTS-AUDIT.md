# Stocklana v6 — Last-Three-Directives Acceptance Audit

This document is the release gate. A feature counts only when it has code, an execution path, and proof. External-network actions are never reported as executed without provider/network receipts.

## Summary

- Requirements audited: **44**
- Executed + proven in-system: **33**
- Fully coded; external credential/wallet/provider authorization required: **7**
- Source/client ready; actual chain deployment still requires a deployment signer/toolchain: **4**
- Market catalog: **360 instruments / 16 families**
- Automatic evaluator: **15 rule families**
- Week run: **100 personalities / 700 sessions / 0 failures**
- Acceptance suite: **1,287 assertions**

## Requirement ledger

| ID | Requirement | Status | Primary evidence |
|---|---|---|---|
| R01 | Laptop trading workstation | `EXECUTED_PROVEN` | index.html, src/styles.css |
| R02 | Responsive phone experience preserved | `EXECUTED_PROVEN` | index.html, src/styles.css |
| R03 | Every navigation tab resolves to a real view | `EXECUTED_PROVEN` | index.html, src/app.js |
| R04 | PreStocks-only eligibility for private-company underlyings | `EXECUTED_PROVEN` | src/market-store.py, programs/stocklana-market/src/lib.rs |
| R05 | Large reinvented instrument universe | `EXECUTED_PROVEN` | src/market-catalog.py |
| R06 | Automatic settlement for every market family | `EXECUTED_PROVEN` | src/settlement-engine.py, src/keeper.py |
| R07 | No Stocklana directional side / fully collateralized default | `EXECUTED_PROVEN` | src/market-store.py, src/market_execution.py |
| R08 | Segregated per-market escrow and fee account | `EXECUTED_PROVEN` | src/market_execution.py, src/finance-store.py |
| R09 | Transferable YES/NO positions | `EXECUTED_PROVEN` | src/market-store.py, src/market_execution.py |
| R10 | Embedded direct access to real PreStocks token market | `CODED_EXTERNAL_AUTH_REQUIRED` | src/solana_finance.py, src/solana-client.js |
| R11 | Solana USDC chain-backed market funding verification | `CODED_EXTERNAL_AUTH_REQUIRED` | server.py: verify_usdc_deposit + trade-chain |
| R12 | Deployable on-chain Stocklana prediction market | `SOURCE_READY_DEPLOYMENT_REQUIRED` | programs/stocklana-market/src/lib.rs, src/stocklana-program-client.js |
| R13 | Resolution tied to Phantasma observation proof | `SOURCE_READY_DEPLOYMENT_REQUIRED` | src/keeper.py, programs/stocklana-market/src/lib.rs |
| R14 | Pyth market-data/oracle adapter | `CODED_EXTERNAL_AUTH_REQUIRED` | src/settlement-engine.py |
| R15 | CASH/TRADING/RESERVE vault | `EXECUTED_PROVEN` | src/finance-store.py, index.html |
| R16 | Internal user-to-user transfers | `EXECUTED_PROVEN` | src/finance-store.py, server.py |
| R17 | Withdrawal reserve -> chain proof -> settlement lifecycle | `EXECUTED_PROVEN` | src/finance-store.py, server.py |
| R18 | MAQUE @handle payments | `EXECUTED_PROVEN` | src/payment_fabric.py, server.py |
| R19 | QR/NFC/payment request transport | `EXECUTED_PROVEN` | src/payment_fabric.py |
| R20 | Offline payments with replay protection | `EXECUTED_PROVEN` | src/payment_fabric.py |
| R21 | Solana Pay merchant/payment requests | `EXECUTED_PROVEN` | src/solana_finance.py, server.py |
| R22 | ISO 20022 banking-language bridge | `EXECUTED_PROVEN` | src/iso20022_bridge.py |
| R23 | Debit/bank/on-ramp routing | `CODED_EXTERNAL_AUTH_REQUIRED` | server.py:/api/funding/onramp, src/payment_fabric.py |
| R24 | One-time virtual card controls backed by reserved funds | `EXECUTED_PROVEN` | src/card_rail.py, src/finance-store.py |
| R25 | Actual external virtual-card issuance connector | `CODED_EXTERNAL_AUTH_REQUIRED` | src/card_rail.py: issue_virtual |
| R26 | 100 AI Agent Vaults | `EXECUTED_PROVEN` | src/agent_vault.py |
| R27 | Scoped AI financial capabilities | `EXECUTED_PROVEN` | src/auth.py, src/agent_vault.py |
| R28 | Wallet-signed human financial sessions | `EXECUTED_PROVEN` | src/auth.py, src/app.js |
| R29 | Phantasma post-quantum security | `EXECUTED_PROVEN` | src/pq_crypto.py, src/finance-store.py |
| R30 | High-throughput PQ finance receipts | `EXECUTED_PROVEN` | src/finance-store.py |
| R31 | Lending/collateral without money creation | `EXECUTED_PROVEN` | src/lending.py |
| R32 | Structured products and baskets | `EXECUTED_PROVEN` | src/market-catalog.py |
| R33 | Payoff/liquidity/basket simulation tools | `EXECUTED_PROVEN` | src/simulations.py |
| R34 | Growth/referral monetization experiments | `EXECUTED_PROVEN` | src/growth.py |
| R35 | At least two surfaces in every bounty-requested category | `EXECUTED_PROVEN` | data/bounty-coverage.json, index.html |
| R36 | Meteora Dynamic Bonding Curve integration | `CODED_EXTERNAL_AUTH_REQUIRED` | src/meteora-dbc.js |
| R37 | Optional Clawpump bounty compatibility | `CODED_EXTERNAL_AUTH_REQUIRED` | src/clawpump.py, server.py |
| R38 | Native Stocklana launch path and fee model | `SOURCE_READY_DEPLOYMENT_REQUIRED` | contracts/MNTY.sol, scripts/launch/create_mnty_solana.mjs |
| R39 | MNTY on Ethereum and Solana | `SOURCE_READY_DEPLOYMENT_REQUIRED` | contracts/MNTY.sol, scripts/launch/create_mnty_solana.mjs |
| R40 | 100 personalities run for seven days | `EXECUTED_PROVEN` | scripts/week100_checkpoint.py, data/agent-personas.json |
| R41 | Judge-grade proofroom and reconstructible ledger | `EXECUTED_PROVEN` | SUBMISSION.md, JOURNAL.md |
| R42 | Software company extends beyond stock trading | `EXECUTED_PROVEN` | MAQUE.md, src/payment_fabric.py |
| R43 | AI-native by default | `EXECUTED_PROVEN` | src/agent_vault.py, src/auth.py |
| R44 | Monetization without taking market direction | `EXECUTED_PROVEN` | src/market-store.py, src/growth.py |

## External execution gates that remain real gates

These are not product placeholders. Their transaction builders/adapters exist, but Stocklana will not invent a receipt:

- **Stocklana Solana program deployment:** requires compiled SBF plus deployment signer; no Program ID is claimed until Solana confirms it.
- **Jupiter Swap V2 fills:** requires Jupiter API access and the user wallet signature; an order plan is not counted as a fill.
- **Meteora DBC:** config/pool/swap builders are implemented; mainnet creation requires the user wallet/RPC and the relevant quote-mint compatibility.
- **ClawPump:** partner/self-funded launch adapters exist; execution requires a `cpk_` partner credential and payment proof.
- **Virtual card issuance:** Stocklana reserves funds and creates one-use policy; actual card issuance requires the issuer/processor connector.
- **Bank/debit on-ramp/off-ramp:** routing and ISO 20022 semantics exist; settlement requires provider confirmation.
- **MNTY:** fixed-supply Ethereum source and Solana Token-2022 mint/revoke path exist; no mainnet contract/mint address is claimed before the signing transaction.

## Non-negotiable accounting/security invariants

- Stocklana market default is fully collateralized pari-mutuel; the house does not take YES or NO.
- Market collateral moves to a segregated market escrow; fees move separately.
- Redemptions decrease outstanding liability via `paidOut`; solvency compares escrow with remaining liability.
- Human account authority comes from Solana wallet challenge signatures; arbitrary `trader` strings are disabled outside explicit dev mode.
- Agent authority is scoped capability tokens; only token commitments are stored.
- Finance events are immediately BLAKE2b-512 hash-linked. High-risk events receive individual ML-DSA-65 + Ed25519 signatures. Normal throughput is finalized by PQ batch anchors every 16 events.
- Private journal records use AES-256-GCM under a journal DEK that is itself protected by ML-KEM-768 + X25519.

## Proof artifacts

- `WEEK-100-PROOF.json` / `WEEK-100-REPORT.md`
- `data/requirements-ledger.json`
- `data/bounty-coverage.json`
- `scripts/test_acceptance.py`
- `SUBMISSION.md`, `JOURNAL.md`, `LEDGER.md`, `SECURITY.md`, `public/ledger.csv`
