# Stocklana Reconstructible Ledger

`public/ledger.csv` and `public/ledger.json` are generated from the clearing runtime rather than manually edited.

The exporter includes:

- PQ receipt chain events;
- market fills;
- Solana signatures when a trade was chain-backed;
- market IDs and actors;
- commitment/previous-commitment links.

Regenerate:

```bash
python3 scripts/export_ledger.py
```

A judge can use the CSV to trace a market fill to its public receipt and, for chain-backed trades, to its Solana transaction signature. Private payloads remain in the encrypted journal rather than the public ledger.
