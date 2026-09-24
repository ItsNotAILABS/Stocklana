# Stocklana v6 Production Gate

## Executed and proven locally

- 360 PreStocks-derived instruments / 16 market families.
- 15 automatic settlement evaluator rule families.
- Exact eight-mint PreStocks allowlist.
- Fully collateralized pari-mutuel default with segregated market escrow and separate protocol fees.
- Shared human/agent trade execution core.
- Market solvency proof with zero house directional exposure.
- CASH / TRADING / RESERVE clearing accounts.
- Transferable YES/NO positions.
- Wallet-signed human sessions and scoped agent capabilities.
- 100 AI Agent Vaults.
- MAQUE @handle, request, QR/NFC payload and offline-intent flows.
- ISO 20022 pain/pacs/camt/remt translation.
- One-use card authorization backed by reserved internal funds.
- Pool-funded lending with locked collateral and no balance creation.
- Payoff/basket/liquidity simulations.
- Referral and creator revenue attribution.
- Phantasma PQ high-throughput receipt architecture.
- Reconstructible ledger / public proofroom.
- 100 personas × 7 days = 700/700 sessions, zero regression failures.
- 1,287 acceptance assertions.

## Fully coded, external authorization required

These paths are executable software but cannot produce a truthful external receipt without the corresponding provider/wallet authorization:

- Jupiter Swap V2 PreStocks order/execute.
- Solana USDC deposit/trade confirmation against a configured treasury.
- Pyth-enhanced observation path.
- Debit/bank/on-ramp provider routing.
- External virtual-card issuance.
- Meteora DBC pool/market transaction.
- ClawPump partner/self-funded launch transaction.

## Source/client ready, deployment transaction required

- Solana Stocklana prediction-market program.
- On-chain resolution commitment binding.
- Native MNTY launch route.
- MNTY Ethereum and Solana deployments.

No Program ID, mint address, pool address, card token or chain signature is manufactured by the release.

## Production invariants

1. Private-company underlyings must be one of the eight PreStocks mints.
2. Market positions cannot be issued without collateral entering segregated escrow.
3. Protocol fees cannot be counted as market collateral.
4. Redemption cannot exceed outstanding collateral liability.
5. Human authority comes from wallet signatures, not request-body identity strings.
6. Agent authority is capability-scoped.
7. Replayed external transaction signatures cannot be credited twice.
8. Card authorization reserves funds before approval.
9. Credit draws come from a funded lending pool.
10. High-risk finance actions have individual hybrid PQ finality; routine throughput receives PQ batch finality.

## External deployment checklist

1. Configure production Solana RPC and public treasury/vault.
2. Configure Jupiter/Pyth/provider credentials.
3. Build and audit `programs/stocklana-market` with the Solana toolchain.
4. Deploy with operator signer and record Program ID + transaction signature.
5. Set the Program ID in the client/config and run initialize/buy/transfer/resolve/redeem on-chain receipt tests.
6. Create a Meteora DBC transaction from the configured launch wallet and record pool/config signatures.
7. Issue the first external virtual card through the authorized issuer adapter; retain only opaque provider identifiers.
8. Deploy MNTY on chosen chains; record contract/mint addresses and immutable supply/mint-authority evidence.
9. Re-run acceptance + HTTP certification and regenerate the PQ-signed release manifest.