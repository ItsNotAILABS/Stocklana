#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${STOCKLANA_PROGRAM_RPC_URL:-https://api.devnet.solana.com}"
PORT="${PORT:-8081}"
KEYPAIR="/tmp/stocklana-devnet-authority.json"
PROGRAM_DIR="$ROOT/programs/stocklana-market"

echo "STOCKLANA_DEVNET_DEPLOY_START"
solana --version
rustc --version
cargo --version

solana-keygen new --no-bip39-passphrase --force -o "$KEYPAIR" >/dev/null
AUTHORITY="$(solana address -k "$KEYPAIR")"
echo "DEPLOY_AUTHORITY=$AUTHORITY"

for i in 1 2 3 4; do
  BAL="$(solana balance -k "$KEYPAIR" --url "$RPC" --lamports 2>/dev/null | tr -dc '0-9' || true)"
  [ "${BAL:-0}" -ge 2500000000 ] && break
  echo "Requesting Devnet SOL airdrop attempt $i..."
  solana airdrop 2 "$AUTHORITY" --url "$RPC" || true
  sleep 4
done

echo "DEPLOY_BALANCE=$(solana balance -k "$KEYPAIR" --url "$RPC")"

cd "$PROGRAM_DIR"
cargo build-sbf
SO="$PROGRAM_DIR/target/deploy/stocklana_market.so"
test -f "$SO"

echo "PROGRAM_BYTES=$(wc -c < "$SO" | tr -d ' ')"
DEPLOY_OUTPUT="$(solana program deploy "$SO" --url "$RPC" --keypair "$KEYPAIR")"
printf '%s\n' "$DEPLOY_OUTPUT"
PROGRAM_ID="$(printf '%s\n' "$DEPLOY_OUTPUT" | sed -n 's/^Program Id: //p' | tail -1)"
test -n "$PROGRAM_ID"

echo "STOCKLANA_PROGRAM_ID=$PROGRAM_ID"
solana program show "$PROGRAM_ID" --url "$RPC"

# The judging deployment is immutable so no ephemeral authority is required after this container.
solana program set-upgrade-authority "$PROGRAM_ID" --final --url "$RPC" --keypair "$KEYPAIR"
echo "PROGRAM_IMMUTABLE=true"
solana program show "$PROGRAM_ID" --url "$RPC"

cat > /tmp/program.json <<JSON
{
  "ok": true,
  "programId": "$PROGRAM_ID",
  "cluster": "devnet",
  "rpc": "$RPC",
  "immutable": true,
  "authority": null
}
JSON

echo "STOCKLANA_DEVNET_DEPLOY_COMPLETE"
cd /tmp
exec python3 -m http.server "$PORT" --bind 0.0.0.0
