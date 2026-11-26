# Stocklana — Perps & Prediction Markets 2026

Status: **PRODUCTION-CAPABLE CODE PATH / MAINNET DEFAULT**

This branch is the canonical Stocklana competition build for Solana Perps & Prediction Markets 2026.

## Product wedge

Stocklana already has a PreStocks market catalog, wallet signing, accounting, receipts, and its own fully collateralized market program. This build adds PREDICT's open-source pm-AMM as a real outcome-token execution venue inside the existing Play / Market Lab experience.

This is not a mock prediction surface. The production path supports:

1. Phantom connection.
2. Mainnet-beta by default with real Circle USDC.
3. Devnet as an optional test network.
4. Real pm-AMM market creation.
5. Live-chain swap quoting using transaction simulation first.
6. Protocol-math fallback using PREDICT's own pm-AMM formulas.
7. Slippage-protected YES / NO purchases.
8. LP deposits.
9. Market state reads.
10. Authority resolution after expiry.
11. Winner claims.
12. Solana transaction receipts surfaced to the user.

## Network configuration

PREDICT uses the same deployed program id across clusters:

`GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y`

Mainnet collateral:

`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` — Circle USDC

Devnet collateral:

`3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ` — PREDICT mock USDC

Production RPC is runtime-configurable:

- `STOCKLANA_PREDICT_MAINNET_RPC_URL`
- `STOCKLANA_PREDICT_DEVNET_RPC_URL`

Use a dedicated production RPC for real traffic. Public Solana RPC is only the fallback default.

## Production quote path

Stocklana does not use a fixed or invented `minOutput`.

For every buy:

1. Fetch the current market account.
2. Derive user YES / NO / collateral token accounts.
3. Include missing ATA creations.
4. Include the actual market creator fee ATA.
5. Include the current PREDICT protocol DAO fee ATA.
6. Build the real PREDICT swap instruction with `minOutput=0`.
7. Simulate the transaction against current chain state and measure the output-token balance delta.
8. Apply the user's configured slippage tolerance to that simulated output.
9. Submit the real swap with the resulting protected minimum.

If simulation is temporarily unavailable, the buy path falls back to PREDICT's exported pm-AMM math using current reserves, time-decayed effective liquidity, and the protocol swap fee.

## Mainnet behavior

Mainnet is **not blocked**.

Real-money actions show an explicit human-readable confirmation before Phantom signing:

- market creation + initial liquidity;
- YES / NO purchase;
- LP deposit;
- authority resolution.

Phantom remains the cryptographic signing boundary. Stocklana never takes or stores a wallet private key.

## Reality ledger

| Capability | State in code | Required evidence to call executed |
|---|---|---|
| PREDICT mainnet program | LIVE UPSTREAM | on-chain program account |
| Mainnet Circle USDC configuration | WIRED | mint + account reads |
| Mainnet market creation | PRODUCTION PATH | confirmed create signature + market PDA |
| Mainnet YES / NO buys | PRODUCTION PATH | confirmed swap signature |
| Mainnet LP deposits | PRODUCTION PATH | confirmed LP signature |
| Mainnet resolution | PRODUCTION PATH / AUTHORITY-BOUND | confirmed resolution signature |
| Mainnet claims | PRODUCTION PATH | confirmed claim signature |
| Devnet faucet | LIVE EXTERNAL PATH | faucet response/signature |
| Pyth / PreStocks automatic resolution | NEXT | deterministic observation + governance policy |
| User / volume / fee analytics | NEXT | indexed on-chain metrics |
| OrbitFlare RPC/WebSocket | CONFIGURABLE | production credentials + runtime setting |

A code path being production-capable is not the same as claiming that the user's wallet has already executed it. Stocklana records and displays actual signatures when execution occurs.

## Known upstream trust model

PREDICT's own mainnet documentation states that its current deployment has centralized resolution, a single-key upgrade authority, and no third-party security audit. Stocklana exposes the rail without hiding those facts. This is an upstream protocol/governance property, not a reason to disable the product.

## Next production gates

- Add market discovery across existing PREDICT mainnet markets, not only locally-created market PDAs.
- Add sell YES / NO execution with the same simulation-first quote path.
- Add Pyth / PreStocks evidence-based resolution policy.
- Add indexed analytics for unique traders, trades, volume, fees and LP depth.
- Add burner-wallet / frictionless onboarding.
- Configure OrbitFlare mainnet RPC/WebSocket during the event.
- Add automated receipt-gated browser acceptance tests.
