# Stocklana Build Journal

## Findings 01–20

1. The PreStocks universe currently gives Stocklana eight eligible underlyings, so differentiation must come from composition rather than adding ineligible pre-IPO tokens.
2. Eight underlyings are enough to generate a much larger derivative surface through thresholds, spreads, relative returns, baskets, and leader markets.
3. A judge should see live markets immediately; relying on a builder screen forces them to imagine the product.
4. Probabilities should come from funded order flow, not invented percentages.
5. A prediction position is itself a transferable financial object and should not be trapped in the buyer account.
6. Wallet-only design forces money to leave the product too often; an internal vault materially improves repeat trading UX.
7. Internal finance state needs cash/trading/reserve separation rather than one undifferentiated balance.
8. Card/on-ramp funding and crypto-wallet funding should converge into the same USDC clearing balance.
9. A deposit signature is insufficient proof unless sender, mint, destination, amount, success state, and replay are all verified.
10. A failed market fill after a confirmed chain payment must leave funds in the user vault rather than lose them.
11. Automatic settlement must reject stale/fallback observations for money-bearing markets.
12. Settlement policy must be machine-readable so a judge can reconstruct why YES or NO won.
13. PreStocks is the primary oracle for PreStocks-native metrics; Pyth becomes additive where a policy has an applicable feed.
14. Threaded HTTP runtimes require serialized ledger mutations or concurrent trades can corrupt balances even with perfect encryption.
15. Plain hash-chain branding is not post-quantum security.
16. Stocklana uses standardized ML-DSA-65 and ML-KEM-768 rather than calling proprietary key rotation "quantum".
17. Hybrid PQ + classical keys reduce dependence on one cryptographic family during migration.
18. Private financial payloads and public audit proofs belong on opposite sides of an explicit proof boundary.
19. A withdrawal should reserve money before signing and should not settle until the outgoing chain transfer is independently verified.
20. Competition-grade submission evidence needs a reproducible ledger, security document, test receipt, and exact artifact hashes/commitments—not screenshots alone.

## Finding 21 — Wallet is the wrong abstraction
On-chain value is ledger state controlled by keys, not bytes stored inside a wallet. Stocklana therefore treats wallets as external signing/settlement connectors and makes the encrypted account fabric the product boundary.

## Finding 22 — Agent Vault inheritance
The earlier Parallax Agent Vault shape compounds directly into Stocklana: multi-ledger connectors, policy/approval gates, receipts, reconciliation, sentinel controls, billing and monetization. Stocklana adds Phantasma PQ provisioning and market positions.

## Finding 23 — Offline requires delayed finality
Offline payments can safely carry signed, expiring, nonce-bound authorization packets, but chain finality cannot be asserted while disconnected. MAQUE accepts the signed packet and settles after reconnection.

## Finding 24 — Fresh-install PQ key mismatch fixed
A release containing public keys but no private keys could generate fresh private keys while retaining stale public keys. Key initialization now always derives/replaces public material from the active private key, preventing split-key deployments.
