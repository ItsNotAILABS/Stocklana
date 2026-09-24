# Stocklana v6 Security Architecture

## Design rule

Cryptography, authorization, accounting consistency and external settlement verification are independent controls. None substitutes for the others.

## Phantasma PQ suite

### Immediate event integrity
Every finance event receives a domain-separated **BLAKE2b-512** commitment and is linked to the previous receipt head.

### High-risk finality
Settlement-sensitive/high-risk events receive individual hybrid signatures:

- **ML-DSA-65** post-quantum signature;
- **Ed25519** classical compatibility signature.

### Throughput finality
Routine events are not forced through a heavyweight PQ signer one-by-one. They remain immediately hash-linked and are finalized in **hybrid PQ batch anchors every 16 events**. This preserves high-throughput payments while retaining post-quantum batch authenticity.

### Private journal
- AES-256-GCM encrypts private journal records.
- A journal root DEK protects the record stream.
- The root key is wrapped through **ML-KEM-768 + X25519** hybrid key establishment.
- runtime private keys are mode 0600 and excluded from release archives.

## Financial authorization

### Humans
A human session starts from a one-time Solana wallet challenge. The wallet signs the challenge and the server verifies the Ed25519 signature. An arbitrary request-body `trader` value has no production authority.

### Agents
AI actors receive scoped capability tokens. The secret is returned once; only the BLAKE2b commitment is stored. Vault policy controls budgets, approvals and action scope.

## Market accounting

The default market model is fully collateralized pari-mutuel:

1. user funds are debited from an authorized vault;
2. stake enters `stocklana:market:<id>:escrow`;
3. protocol fee moves separately to the fee account;
4. position shares represent stake in YES or NO pool;
5. resolution selects the winning pool;
6. redemption transfers only from existing market escrow;
7. `paidOut` reduces outstanding liability;
8. solvency requires escrow >= outstanding liability;
9. Stocklana never owns the YES or NO side.

All balance/position mutations use serialized single-writer locking in the local clearing engine.

## External Solana funding verification

A chain-backed credit/trade can only be accepted after RPC evidence proves:

- transaction succeeded;
- expected USDC mint was used;
- configured Stocklana vault received sufficient USDC;
- claimed sender funded the transaction as expected;
- signature has not already been credited.

External signatures are one-use settlement references.

## Withdrawal state machine

`REQUEST -> RESERVED -> AUTHORIZED -> CHAIN TRANSFER -> RPC VERIFIED -> SETTLED`

Cancellation releases the reserve. A withdrawal is not marked settled merely because an internal balance was debited.

## Automatic resolution proof

Keeper settlement stores the source, observation timestamp, exact rule inputs, outcome and signed proof commitment. The Solana program source stores a 32-byte resolution commitment with the resolved outcome so the chain state can be tied to the external proof package.

## MAQUE offline security

Offline payment packets are device-bound Ed25519 authorizations with:

- expiry;
- one-time nonce;
- replay rejection;
- later Phantasma receipt finality when accepted by Stocklana.

Offline authorization is not described as offline chain settlement.

## One-time card controls

Stocklana reserves the authorized funds before a one-use card policy can be approved. Capture moves reserved funds into card clearing; cancellation restores them. External PAN/token issuance is delegated to an authorized issuer adapter, and Stocklana stores only opaque provider references—not PAN/CVV.

## Lending conservation

Credit cannot mint balance. Principal comes from `stocklana:lending-pool`; collateral is locked before draw; principal returns to the pool; interest is accounted separately; collateral releases only after repayment conditions pass.

## Deployment secrets never shipped

Do not package:

- PQ private PEM keys;
- Solana treasury/deployer private keys;
- Jupiter/Pyth/ClawPump/card-provider credentials;
- raw card PAN/CVV;
- bank credentials.

Public configuration and verification keys may ship; signing authority does not.
