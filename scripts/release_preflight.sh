#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
PROGRAM_DIR="$ROOT/programs/stocklana-market"
SO="$PROGRAM_DIR/target/deploy/stocklana_market.so"

need(){ command -v "$1" >/dev/null || { echo "missing:$1"; exit 2; }; }
need node
need cargo
need solana
need curl

cd "$ROOT"
node scripts/build_static_release.mjs >/dev/null
FRONTEND_BYTES="$(find dist -type f -printf '%s\n' | awk '{s+=$1} END{print s+0}')"
TURBO_PRICE="$(curl -fsSL "https://turbo.ardrive.io/price/solana/$FRONTEND_BYTES" || true)"

cd "$PROGRAM_DIR"
cargo build-sbf >/dev/null
PROGRAM_BYTES="$(wc -c < "$SO" | tr -d ' ')"
PROGRAM_RENT="$(solana rent "$PROGRAM_BYTES" --url "$RPC_URL" | tail -1)"
PROGRAM_RENT_LAMPORTS="$(solana rent "$PROGRAM_BYTES" --lamports --url "$RPC_URL" | tr -dc '0-9')"

cd "$ROOT"
mkdir -p deployments
OUT="deployments/release-preflight.json"
cat > "$OUT" <<JSON
{
  "network": "solana-mainnet",
  "rpc": "$RPC_URL",
  "programBytes": $PROGRAM_BYTES,
  "programRentDisplay": $(python3 - <<PY
import json
print(json.dumps("""$PROGRAM_RENT"""))
PY
),
  "programRentLamports": "${PROGRAM_RENT_LAMPORTS:-unknown}",
  "baseFeePerSignatureLamports": 5000,
  "frontendBytes": $FRONTEND_BYTES,
  "turboPriceRaw": $(python3 - <<PY
import json
print(json.dumps("""$TURBO_PRICE"""))
PY
),
  "notes": [
    "Solana docs state program deployment cost depends on compiled program size.",
    "Keep extra SOL above rent for deployment transaction and optional priority fees.",
    "Turbo permanent-storage pricing is live and byte-based; this preflight records the current quote."
  ]
}
JSON
cat "$OUT"
echo
echo "Preflight receipt: $OUT"
