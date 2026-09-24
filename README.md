# Stocklana V2 — Programmable Tokenized-Equity Account on Solana

Stocklana V2 is the productized version of the financial infrastructure built across the earlier releases. The app is now organized around immediate user jobs rather than protocols: **Buy · Auto-invest · Borrow · Play · Send · Spend · Agent · Launch**.

The user-facing default is **Token-2022 V2**. Internal double-entry accounting remains the source of financial truth; programmable public receipts use V2 Token-2022 profiles only where composability or policy needs to travel with the claim. The earlier V1 issuance path is removed from the product surface.

### V2 acceptance

- 145/145 dedicated V2 UX assertions pass.
- 1,342 core acceptance assertions pass.
- 494 accounting / backing assertions pass.
- 360 programmable instruments across 16 families remain available.
- 100 Agent Vaults and the 700/700 seven-day workload remain part of the regression evidence.
- 10/10 navigation views resolve.
- Browser HTTP/API certification passes; Chromium visual capture was attempted but did not complete in this runtime, so visual browser automation is not claimed.

See `V2-PRODUCT.md` for the experience contract and `docs/V2-FINANCIAL-SUBSTRATE.md` for the token/accounting substrate.

## V2 financial token substrate

Stocklana now has a typed financial accounting layer underneath markets, Agent Vaults, MAQUE and tokenized-equity workflows. It is deliberately not an unbacked protocol coin.

**Internal token grammar:** `SL-CASH`, `SL-ESCROW`, `SL-COLL`, `SL-FEE`, `SL-CREDIT`, `SL-AGENT`, `SL-POS`, `SL-BASKET`. Monetary claims are reconciled to segregated USDC or an already-funded pool; agent budgets and position units are explicitly marked non-cash. `src/accounting_tokens.py` compiles financial events into a balanced double-entry journal and exposes `StocklanaFinancialDigest/v2` to both humans and agents.

**V2 — Token-2022 programmable lane:** `src/token2022-accounting.js` creates selected receipt classes with `MetadataPointer`, `NonTransferable`, or `TransferHook` extensions. Escrow/collateral/credit/agent receipts are restricted; position and basket receipts can carry transfer policy. `SL-CASH` stays internal rather than becoming a casually issued bearer stablecoin.

V2 is the product default. Internal accounting remains the source of truth while Token-2022 carries programmable public claims. See `docs/V2-FINANCIAL-SUBSTRATE.md`.

## Product surface

### 360-instrument market factory

`src/market-catalog.py` generates **360 unique instruments across 16 families** from the eight PreStocks assets:

- valuation thresholds and valuation zones;
- token-price thresholds and price zones;
- premium/discount convergence;
- absolute-move contracts;
- relative-return and valuation-spread pairs;
- joint-positive outcomes;
- basket thresholds and basket leaders;
- universe leaders;
- Gain Games;
- Downside Shields;
- Margin Duels;
- Green-Majority basket games.

All generated templates carry machine-readable settlement rules. `src/settlement-engine.py` automatically evaluates **15 rule families**.

### Fully collateralized market execution

The production default is a **pari-mutuel collateral pool**, not an unfunded synthetic market maker.

- every YES/NO stake moves into segregated per-market escrow;
- protocol fees move to a separate fee account;
- the house never takes a YES or NO position;
- winning payouts can only come from collateral already present;
- `paidOut` reduces remaining liability after each redemption;
- `src/market_execution.py` is the shared execution core for humans, agents and tests;
- a market solvency endpoint exposes escrow, collateral, paid-out amount, outstanding liability and house directional exposure.

### Embedded PreStocks execution

`src/solana_finance.py` and `src/solana-client.js` implement Jupiter Swap V2 order/execute paths for buying or selling an eligible PreStocks token through a connected Solana wallet.

A plan is not counted as a fill. A completed external execution requires the provider response and the user's wallet-signed chain result.

### On-chain Stocklana market program

`programs/stocklana-market/` contains the current Solana market source:

- exact eight-mint PreStocks allowlist;
- USDC collateral only;
- market / position / vault-authority / fee-authority PDAs;
- SPL-token collateral transfer into program vaults;
- separate fee vault;
- YES/NO pool accounting;
- transferable positions;
- time-gated resolution;
- proportional redemption from escrow;
- fee withdrawal;
- on-chain `resolution_commitment` binding the Boolean outcome to the external Phantasma/PreStocks/Pyth observation proof.

`src/stocklana-program-client.js` constructs initialize, buy, transfer, resolve, redeem and fee-withdraw transactions using matching PDA derivation.

No Program ID is invented by this package. Deployment requires a Solana build/deployment signer and a confirmed deployment transaction.

## Stocklana Vault + PARRALAX clearing lineage

Users and agents operate through the same financial fabric rather than separate wallet silos.

- CASH / TRADING / RESERVE subaccounts;
- internal transfers;
- verified Solana USDC deposits;
- segregated market escrow;
- transferable market positions;
- reserve -> authorize -> chain-confirm withdrawal lifecycle;
- reconstructible public ledger;
- conservation and concurrency testing.

Human authority comes from a one-time Solana wallet challenge. Agent authority comes from scoped capability tokens whose secrets are returned once while only commitments are retained server-side.

## 100 AI Agent Vaults

`src/agent_vault.py` provisions policy-scoped Agent Vaults with:

- CASH / TRADING / RESERVE / FEES accounts;
- Solana, EVM, ICP, Bitcoin-watch and Cosmos connector descriptors;
- spend budgets and approval thresholds;
- market permissions;
- reconciliation;
- Sentinel replay / velocity / anomaly checks;
- billing and monetization metadata;
- positions and receipts;
- Phantasma PQ provisioning proof.

The seven-day regression uses **100 distinct personas** rather than repeating one scripted actor.

## MAQUE Pay Fabric

MAQUE is the payment/account layer underneath the vertical:

- `@handle` transfers;
- QR / NFC / payment-link requests;
- device-bound offline authorization with expiry and nonce replay protection;
- internal settlement;
- Solana payment requests;
- bank/debit/card routing intents;
- human and agent payment identities.

Offline authorization is never mislabeled as offline blockchain finality: the signed intent can be created offline, while settlement finality occurs when a connected rail confirms it.

## ISO 20022 interoperability

`src/iso20022_bridge.py` translates the Stocklana/MAQUE canonical payment object into:

- `pain.001` payment initiation;
- `pacs.008` clearing/settlement;
- `camt.053` account statement/reconciliation;
- `remt.001` remittance context.

This gives Solana, internal clearing, card-processor and bank connectors one shared financial vocabulary.

## One-time virtual-card funding controls

`src/card_rail.py` implements a real internal authorization model:

- one-use spending policy;
- merchant/MCC/amount/expiry controls;
- actual Stocklana funds reserved before approval;
- capture into a card-clearing account;
- cancellation/reversal restoring the reserve;
- hybrid PQ authorization proof;
- opaque external issuer-token handling only—Stocklana never fabricates or stores PAN/CVV.

External issuance requires `CARD_ISSUER_PROXY_URL` and provider authorization.

## Lending, simulations and growth

- `src/lending.py`: funded liquidity pool, capped LTV, locked collateral, principal return, interest accounting, no money creation.
- `src/simulations.py`: payoff, basket and liquidity stress scenarios.
- `src/growth.py`: referral attribution, conversion/revenue events and creator-share accounting.

## Launch infrastructure

- `contracts/MNTY.sol`: fixed-supply Ethereum token source.
- `scripts/launch/create_mnty_solana.mjs`: Solana Token-2022 mint path with optional transfer fee extension and mint-authority revocation.
- `src/meteora-dbc.js`: Meteora DBC config/pool/quote/buy builders with DAMM v2 migration settings.
- `src/clawpump.py`: optional ClawPump partner/self-funded launch adapters.

No launch is represented as complete without the provider/chain receipt.

## Phantasma post-quantum finance security

The current high-throughput design is **not** “PQ-sign every tiny ledger event.” It is a clearinghouse-style two-level proof system:

1. Every finance event is immediately domain-separated and BLAKE2b-512 hash-linked.
2. High-risk settlement/security events receive an individual **ML-DSA-65 + Ed25519** hybrid signature.
3. Normal event throughput is finalized by a hybrid PQ batch anchor every 16 events.
4. Private journal records use AES-256-GCM under a journal data-encryption key.
5. The journal root key is protected by a hybrid **ML-KEM-768 + X25519** envelope.
6. Runtime private keys are mode 0600 and excluded from release archives.

## Laptop + mobile product

The laptop workstation exposes **8 verified views**:

1. Market Desk
2. Instrument Forge
3. Vault & MAQUE
4. Positions
5. Agent Network
6. Infrastructure
7. Bounty Matrix
8. Launch

The responsive phone experience remains underneath the workstation layout.

## Bounty coverage

`data/bounty-coverage.json` contains at least two implemented/code-backed lanes for every requested category: derivatives, DeFi, tools, games, AI agents, prediction markets, social/community, lending/collateral, structured products, launchpads, automations, simulations, growth experiments and new concepts.

## Proof

Current acceptance gate:

- **360** unique instruments / **16** families;
- **15** automatic settlement rule families;
- **100** distinct agent personalities;
- **700 / 700** seven-day sessions completed;
- **0** regression failures;
- all exercised markets solvent;
- house directional exposure = **0**;
- **1,343 passing acceptance assertions**;
- **8 / 8** workstation navigation targets;
- **100 / 100** ISO 20022 translations in workstation test;
- **100** concurrent transfer conservation check;
- real ML-DSA / ML-KEM primitive tests pass.

See `REQUIREMENTS-AUDIT.md`, `WEEK-100-REPORT.md`, `ACCEPTANCE-RESULT.json`, `SECURITY.md`, `SUBMISSION.md` and `public/ledger.csv`.

## v8 — Live ETH launch exchange

Stocklana now embeds the live Pons v2 launch protocol on Robinhood Chain instead of routing creators out to a separate launchpad. The Launch workstation can connect an injected EVM wallet, read the live factory configuration and launch fee, deploy a Pons v2 token, import an existing token by full contract address, read its authoritative launch phase, curve reserves and graduation progress, and execute wallet-signed buys/sells against its curve.

Pinned production integration:

- Robinhood Chain mainnet: chain id `4663`;
- Pons v2 factory: `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`;
- native ETH or approved custom ERC-20 quote assets;
- creator tax and buyback configuration are launch-time terms;
- launch completion is recorded only after the wallet transaction receives a chain receipt;
- imported launches are never claimed as Stocklana-deployed unless a matching Stocklana launch receipt exists.

Run `python3 scripts/test_pons_surface.py` for the 27-assertion launch integration gate.

## Run

```bash
python3 server.py --host 0.0.0.0 --port 5173
```

Useful production configuration includes:

```bash
export SOLANA_RPC_URL='https://...'
export STOCKLANA_VAULT_ADDRESS='<USDC treasury public address>'
export STOCKLANA_KEEPER_TOKEN='<high entropy secret>'
export JUPITER_API_KEY='<provider credential>'
export PYTH_API_KEY='<provider credential>'
export CARD_ISSUER_PROXY_URL='<issuer adapter URL>'
export CARD_ISSUER_PROXY_TOKEN='<issuer adapter token>'
export CLAWPUMP_API_KEY='<partner credential>'
```

External credentials authorize external systems; they do not change Stocklana's internal accounting invariants.