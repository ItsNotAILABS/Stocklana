#!/usr/bin/env bash
set -euo pipefail

RPC="${STOCKLANA_PROGRAM_RPC_URL:-https://api.devnet.solana.com}"
PORT="${PORT:-8081}"
REPO="${STOCKLANA_REPO_URL:-https://github.com/ItsNotAILABS/Stocklana.git}"
BRANCH="${STOCKLANA_REPO_BRANCH:-main}"
KEYPAIR="/tmp/stocklana-devnet-authority.json"
WORK="/tmp/stocklana-source"

echo "STOCKLANA_DEVNET_DEPLOY_START"
echo "RPC=$RPC"
solana --version
rustc --version
cargo --version

rm -rf "$WORK"
git clone --depth 1 --branch "$BRANCH" "$REPO" "$WORK"
cd "$WORK"
echo "SOURCE_COMMIT=$(git rev-parse HEAD)"

solana-keygen new --no-bip39-passphrase --force -o "$KEYPAIR" >/dev/null
AUTHORITY="$(solana address -k "$KEYPAIR")"
echo "DEPLOY_AUTHORITY=$AUTHORITY"

for i in 1 2 3 4 5; do
  BAL="$(solana balance -k "$KEYPAIR" --url "$RPC" --lamports 2>/dev/null | tr -dc '0-9' || true)"
  if [ "${BAL:-0}" -ge 2500000000 ]; then break; fi
  echo "DEVNET_AIRDROP_ATTEMPT=$i"
  solana airdrop 2 "$AUTHORITY" --url "$RPC" || true
  sleep 5
done
BAL="$(solana balance -k "$KEYPAIR" --url "$RPC" --lamports 2>/dev/null | tr -dc '0-9' || true)"
if [ "${BAL:-0}" -lt 2500000000 ]; then
  echo "PUBLIC_RPC_AIRDROP_RATE_LIMITED=true"
  echo "POW_FAUCET_START=true"
  devnet-pow --keypair-path "$KEYPAIR" --url dev mine --target-lamports 3000000000 || true
fi

echo "DEPLOY_BALANCE=$(solana balance -k "$KEYPAIR" --url "$RPC")"
BAL="$(solana balance -k "$KEYPAIR" --url "$RPC" --lamports 2>/dev/null | tr -dc '0-9' || true)"
if [ "${BAL:-0}" -lt 1000000000 ]; then
  echo "ERROR=unable_to_fund_devnet_deployer"
  exit 7
fi

cd "$WORK/programs/stocklana-market"
cargo build-sbf
SO="$WORK/programs/stocklana-market/target/deploy/stocklana_market.so"
test -f "$SO"
echo "PROGRAM_BYTES=$(wc -c < "$SO" | tr -d ' ')"

DEPLOY_OUTPUT="$(solana program deploy "$SO" --url "$RPC" --keypair "$KEYPAIR")"
printf '%s\n' "$DEPLOY_OUTPUT"
PROGRAM_ID="$(printf '%s\n' "$DEPLOY_OUTPUT" | sed -n 's/^Program Id: //p' | tail -1)"
test -n "$PROGRAM_ID"
echo "STOCKLANA_PROGRAM_ID=$PROGRAM_ID"

solana program show "$PROGRAM_ID" --url "$RPC"
solana program set-upgrade-authority "$PROGRAM_ID" --final --url "$RPC" --keypair "$KEYPAIR"
echo "PROGRAM_IMMUTABLE=true"
solana program show "$PROGRAM_ID" --url "$RPC"

mkdir -p /tmp/public
cat > /tmp/public/program.json <<JSON
{
  "ok": true,
  "programId": "$PROGRAM_ID",
  "cluster": "devnet",
  "rpc": "$RPC",
  "immutable": true,
  "sourceCommit": "$(git -C "$WORK" rev-parse HEAD)"
}
JSON

echo "STOCKLANA_DEVNET_DEPLOY_COMPLETE"
cd /tmp/public
exec python3 -m http.server "$PORT" --bind 0.0.0.0
