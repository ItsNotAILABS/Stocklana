# Operator Boundary

Stocklana separates user authorization, market settlement, and treasury signing.

- Users sign their own Solana deposits and chain-backed market payments.
- The server verifies chain facts; it does not accept a client assertion that payment happened.
- The keeper can resolve only due markets and only from a live PreStocks observation; keeper access is authenticated.
- Treasury withdrawals require a reserved internal balance plus an independently verifiable outgoing Solana transaction.
- Treasury private keys are intentionally not part of the release package. Production should use a hardware/remote signer or a separately governed signer service.
- PQ private keys are runtime secrets and are excluded from release archives.
- Development credit is disabled unless `STOCKLANA_DEV_CREDIT=1` is explicitly set.
