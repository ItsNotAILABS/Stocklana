# Stocklana - Perps & Prediction Markets 2026

Status: **ACTIVE BUILD / DEVNET-FIRST**

This branch is for the Solana Perps and Prediction Markets hackathon launching December 1, 2026.

## Product wedge

Stocklana already has a PreStocks market catalog, wallet signing, accounting, receipts, and a custom fully collateralized market program. The new competition rail adds the open-source Predict pm-AMM as the actual outcome-token execution venue instead of pretending the existing pari-mutuel engine is a pm-AMM.

The first shipped slice is deliberately narrow:

1. Connect Phantom on Solana Devnet.
2. Claim official Predict faucet mUSDC/SOL.
3. Create a real binary pm-AMM market with real on-chain liquidity.
4. Buy YES or NO through the Predict SDK.
5. Read market state from Solana.
6. Resolve through the market authority after expiry.
7. Claim winnings.
8. Surface every transaction signature as a receipt.

## Reality ledger

| Capability | Current state | Evidence required before promotion |
|---|---|---|
| Predict program | LIVE upstream | Official program ID |
| Stocklana Predict rail | CODED / WALLET VERIFICATION REQUIRED | Browser transaction signatures |
| Devnet market creation | CODED | createMarket signature + market PDA |
| Devnet swaps | CODED | swap signature |
| Resolution | CODED / authority path | resolve signature after endTs |
| Claims | CODED | claim signature |
| Mainnet trading | BLOCKED | exact quote/minOutput helper + mainnet QA + user approval |
| Pyth/PreStocks auto-resolution | NOT YET WIRED | deterministic observation + dispute/authority policy |
| Burner-wallet onboarding | NOT YET WIRED | one-tap visitor flow + faucet receipts |
| OrbitFlare RPC | CONFIGURABLE NEXT | hackathon credentials + measured RPC/WebSocket path |

## Why mainnet is blocked in the first slice

The Predict builder kit explicitly warns against hand-rolled quotes because reserves are time-adjusted before each swap. The first Stocklana rail therefore permits proof trades only on Devnet and refuses mainnet execution until Predict's exact quoteSwap/minOutput helper is vendored and tested. This is an intentional production-safety gate, not a missing-success state.

## Next build gates

- Vendor exact pm-AMM quote/minOutput helper.
- Add market-list batching and 15-second visibility-aware polling.
- Add Stocklana template -> Predict market mapping.
- Add PreStocks/Pyth resolution adapter with evidence commitment.
- Add burner-wallet path for judge/user traction without requiring Phantom.
- Add per-market analytics for users, trades, volume, fees, and LP depth.
- Add OrbitFlare RPC/WebSocket runtime configuration.
- Add an end-to-end acceptance script that rejects a release without real signatures.
