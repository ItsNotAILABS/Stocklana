#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROGRAM_DIR="$ROOT/programs/stocklana-market"
RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
KEYPAIR="${SOLANA_KEYPAIR_PATH:-$HOME/.config/solana/id.json}"
PROGRAM_KEYPAIR="${STOCKLANA_PROGRAM_KEYPAIR:-}"

command -v solana >/dev/null || { echo "solana CLI is required"; exit 2; }
command -v cargo >/dev/null || { echo "Rust/cargo is required"; exit 2; }
test -f "$KEYPAIR" || { echo "Signer keypair not found: $KEYPAIR"; exit 2; }

echo "== Stocklana Solana mainnet deployment =="
echo "RPC: $RPC_URL"
echo "Signer: $(solana address -k "$KEYPAIR")"
echo "Balance: $(solana balance -k "$KEYPAIR" --url "$RPC_URL")"
echo
read -r -p "Type DEPLOY-MAINNET to build and submit the Stocklana market program: " CONFIRM
test "$CONFIRM" = "DEPLOY-MAINNET" || { echo "Cancelled"; exit 3; }

cd "$PROGRAM_DIR"
cargo build-sbf
SO="$PROGRAM_DIR/target/deploy/stocklana_market.so"
test -f "$SO" || { echo "Build output missing: $SO"; exit 4; }

mkdir -p "$ROOT/deployments"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/deployments/solana-mainnet-$TS.txt"

{
  echo "timestamp=$TS"
  echo "rpc=$RPC_URL"
  echo "authority=$(solana address -k "$KEYPAIR")"
  echo "artifact=$SO"
  echo "artifact_sha256=$(shasum -a 256 "$SO" | awk '{print $1}')"
} | tee "$OUT"

ARGS=(program deploy "$SO" --url "$RPC_URL" --keypair "$KEYPAIR")
if [ -n "$PROGRAM_KEYPAIR" ]; then
  test -f "$PROGRAM_KEYPAIR" || { echo "Program keypair not found: $PROGRAM_KEYPAIR"; exit 5; }
  ARGS+=(--program-id "$PROGRAM_KEYPAIR")
fi

echo
echo "Submitting deployment..."
DEPLOY_OUTPUT="$(solana "${ARGS[@]}")"
printf '%s\n' "$DEPLOY_OUTPUT" | tee -a "$OUT"
PROGRAM_ID="$(printf '%s\n' "$DEPLOY_OUTPUT" | sed -n 's/^Program Id: //p' | tail -1)"
test -n "$PROGRAM_ID" || { echo "Could not parse Program Id; inspect $OUT"; exit 6; }

echo "program_id=$PROGRAM_ID" | tee -a "$OUT"
solana program show "$PROGRAM_ID" --url "$RPC_URL" | tee -a "$OUT"
echo
echo "DEPLOYED: $PROGRAM_ID"
echo "Receipt: $OUT"
