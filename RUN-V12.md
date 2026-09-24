# Run Stocklana V12 Web App

This is a desktop-first web application with responsive mobile support.

## Start

```bash
cd stocklana-v12-web
python3 server.py --host 0.0.0.0 --port 5173
```

Open:

`http://localhost:5173`

Or:

```bash
npm run dev
```

## Included execution layers

- browser application UI
- Python HTTP/API server
- tokenized-equity adapters
- 360-instrument market engine and settlement rules
- V2 accounting/token substrate
- Stocklana Vault / MAQUE
- Agent Vaults and guarded purchase policy
- ISO 20022 bridge
- Solana/Jupiter/Kamino/Meteora integrations
- Pons v2 Robinhood Chain launcher
- Stocklana Solana program source + transaction client
- Phantasma PQ receipt/journal layer
- tests, certification, proof artifacts

The application is the ZIP. Preview images are secondary artifacts only.