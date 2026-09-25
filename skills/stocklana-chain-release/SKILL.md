---
name: stocklana-chain-release
description: Prepare and release Stocklana across Solana and the separate CMESH Pons/Robinhood Chain surface. Use for Solana program builds/deploys, permanent frontend releases, runtime configuration, CMESH verification, and deployment receipts.
---

# Stocklana Chain Release

## Chain boundaries
- Solana: PreStocks, Phantom, USDC, Jupiter, Stocklana market program, Token-2022 and market/accounting rails.
- Robinhood Chain: CMESH / CipherMesh via Pons.
- Never label CMESH as a PreStock.

## Solana program release
- Run syntax/tests first.
- Build with cargo build-sbf.
- Deploy only with the user's funded signer to the explicit target cluster.
- Record Program ID, authority, deployment output, and program-show verification.
- Never commit signer files.

## Permanent frontend
- Build static release with STOCKLANA_PUBLIC_API_ORIGIN.
- Upload dist through Turbo authenticated with a Solana deployment wallet.
- Record the immutable manifest transaction ID.
- Optionally update an existing ArNS name to the manifest.
- Configure STOCKLANA_CORS_ORIGIN on the API.

## CMESH
- Require a full exact 0x address.
- Verify it through the Pons factory as CipherMesh/CMESH before binding.
- Store it in STOCKLANA_CMESH_ADDRESS for production.
- A truncated explorer hint is never sufficient.

## Completion
No external action is complete without the authoritative chain/provider receipt.
