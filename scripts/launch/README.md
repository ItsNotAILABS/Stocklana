# MNTY dual-chain launch

## Solana
`npm install @solana/web3.js @solana/spl-token`

`SOLANA_KEYPAIR=/path/to/id.json SOLANA_RPC_URL=<rpc> MNTY_SUPPLY=1000000000 node scripts/launch/create_mnty_solana.mjs`

The script creates a Token-2022 mint, optionally configures transfer fees, mints the fixed supply to the signer, and revokes mint authority. It prints the confirmed transaction signature.

## Ethereum
`contracts/MNTY.sol` is a self-contained fixed-supply ERC-20 contract. Compile/deploy with the operator's normal Solidity toolchain/wallet. No private key is shipped in Stocklana.
