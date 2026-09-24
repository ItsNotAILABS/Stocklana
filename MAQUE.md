# MAQUE Pay Fabric — Stocklana Physical-Money Layer

MAQUE removes the wallet application as the primary product metaphor. Assets remain on their native ledgers; Stocklana stores governed account state, positions, permissions, receipts, routing intents, and cryptographic capabilities. External wallets are connectors, not the account itself.

## Human payment surfaces

- `@handle` — resolve a human-readable recipient to an internal Stocklana account.
- QR / payment link — PQ-signed payment request transport.
- NFC — same payment request encoded as `application/vnd.maque.pay+json`.
- Offline intent — payer device signs an expiring Ed25519 payment intent locally. The receiver can carry the packet until reconnection. Server acceptance enforces device ownership, expiry and nonce replay protection, then emits a hybrid ML-DSA-65 + Ed25519 receipt before settlement.
- Internal rail — immediate ledger transfer without requiring an on-chain hop for every movement.
- Solana USDC rail — verified chain deposit/withdrawal path.
- Card/bank cash-out — authenticated routing intent. A provider receipt is required before Stocklana may claim external settlement.

Offline is authorization transport, not offline blockchain finality. No network means the system cannot know current chain state, so final settlement occurs after reconnection.

## Agent Vault

Every created Stocklana agent receives its own vault with CASH, TRADING, RESERVE and FEES pockets; Solana/EVM/ICP/Bitcoin-watch/Cosmos connectors; spend limits; human approval thresholds; external-withdrawal gate; sentinel/replay/velocity policy; reconciliation state; billing; monetization balances; positions; and Phantasma PQ provisioning proof.

## Cryptographic boundary

Financial receipts: ML-DSA-65 + Ed25519. Private envelopes: ML-KEM-768 + X25519 with AES-256-GCM payload encryption. Commitments: BLAKE2b-512. Device-local offline authorization: Ed25519, followed by a server-side hybrid PQ receipt. Release archives contain public verification material only.