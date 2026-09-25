# Stocklana — Hybrid Solana Release

Stocklana ships as two production layers. This is intentional.

## 1. Solana executable layer

For judging, Stocklana now defaults its custom coordination program to **Solana Devnet** while the real PreStocks/Jupiter wallet lane can remain on Solana mainnet-beta. This is the intended hybrid architecture: decentralized trust / market state on Solana, heavier orchestration and external-provider work off-chain.

The on-chain Stocklana market program lives in `programs/stocklana-market`. It enforces:

- the exact eight PreStocks mints;
- USDC collateral;
- fully collateralized YES/NO pools;
- market / position / vault / fee PDAs;
- transferable positions;
- resolution commitments and redemption.

A Devnet judging deployment does not require paid SOL; the deployment script requests faucet SOL when the signer is low. Never commit a signer keypair.

```bash
export SOLANA_KEYPAIR_PATH="$HOME/.config/solana/id.json"
npm run deploy:program:devnet
```

Mainnet remains available later:

```bash
npm run deploy:program:mainnet
```

The script builds with `cargo build-sbf`, requires an explicit cluster confirmation, submits the program, and writes the Program ID plus CLI receipt under `deployments/`.

After deployment set:

```bash
export STOCKLANA_PROGRAM_CLUSTER='devnet'
export STOCKLANA_PROGRAM_RPC_URL='https://api.devnet.solana.com'
export STOCKLANA_PROGRAM_ID='<confirmed program id>'
```

The user-facing PreStocks wallet rail remains separately configurable with `SOLANA_RPC_URL` and defaults to mainnet-beta.

Do not call the program deployed until `solana program show <PROGRAM_ID>` confirms it.

## 2. Permanent browser layer controlled by a Solana wallet

The browser app cannot literally execute from inside a Solana program. The production web release is built as static files, then can be stored permanently on Arweave through Turbo using a Solana deployment wallet.

Install dependencies:

```bash
npm install
```

Build a permanent-web bundle:

```bash
export STOCKLANA_PUBLIC_API_ORIGIN='https://api.stocklana.example'
npm run build:static
```

Upload the bundle with the Solana wallet:

```bash
export SOLANA_KEYPAIR_PATH="$HOME/.config/solana/id.json"
npm run deploy:frontend:solana
```

The deployer writes a second receipt under `deployments/` with the immutable Arweave manifest ID and permanent gateway URL.

The API origin is intentionally runtime-configurable so the permanent frontend can call Stocklana's off-chain orchestration/API service while Phantom continues signing Solana actions locally.

For a stable human-readable permanent name, bind the resulting manifest to an ArNS name controlled by the Solana owner after the first successful permanent upload.

## 3. Production API

If the permanent frontend is not served from the same origin as `server.py`, configure the exact frontend origin:

```bash
export STOCKLANA_CORS_ORIGIN='https://<your-permanent-or-custom-domain>'
python3 server.py --host 0.0.0.0 --port 5173
```

Keep these secrets only in the API deployment environment:

- `JUPITER_API_KEY`
- `PYTH_API_KEY`
- `CARD_ISSUER_PROXY_TOKEN`
- `CLAWPUMP_API_KEY`
- any infrastructure provider secrets

## 4. CMESH is a separate chain lane

CMESH / CipherMesh is **not a PreStock**.

It remains:

- role: Stocklana platform token
- origin: Pons
- chain: Robinhood Chain
- chain ID: 4663

Set the exact verified contract after confirmation:

```bash
export STOCKLANA_CMESH_ADDRESS='0x...full verified CMESH token address...'
```

The CMESH tab verifies the address against the Pons factory before showing it as CMESH. Do not place the token in `data/prestocks-snapshot.json`, the Solana PreStocks allowlist, or any PreStocks bounty route.

## Receipt rule

A release is complete only when the corresponding external receipt exists:

- Solana market program: Program ID + deployment signature / `solana program show`
- permanent frontend: Arweave manifest transaction ID
- CMESH: exact token address + Robinhood Chain/Pons state
- swaps/trades/purchases: provider or chain receipt

Never substitute a configured route, local test, or transaction builder for a mainnet receipt.
