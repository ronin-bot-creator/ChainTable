#!/usr/bin/env bash
set -euo pipefail

# Deploy UnoLobby locally with anvil + forge
# Usage: ./scripts/deploy_local.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# load .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# defaults
if [ -z "${PRIVATE_KEY-}" ]; then
  PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
fi
if [ -z "${DEV_WALLET-}" ]; then
  DEV_WALLET="0x0000000000000000000000000000000000000000"
fi
ANVIL_PORT=${ANVIL_PORT:-8545}
ANVIL_HOST=${ANVIL_HOST:-127.0.0.1}
RPC_URL="http://${ANVIL_HOST}:${ANVIL_PORT}"

echo "Using RPC_URL=$RPC_URL"
echo "Using DEV_WALLET=$DEV_WALLET"

command -v anvil >/dev/null 2>&1 || { echo "anvil not found; install foundry (https://book.getfoundry.sh/)"; exit 1; }
command -v forge >/dev/null 2>&1 || { echo "forge not found; install foundry"; exit 1; }

TMP_LOG="/tmp/anvil-$$.log"

echo "Starting anvil (logs -> $TMP_LOG)"
anvil --host $ANVIL_HOST --port $ANVIL_PORT > "$TMP_LOG" 2>&1 &
ANVIL_PID=$!
trap 'echo "Stopping anvil ($ANVIL_PID)"; kill $ANVIL_PID 2>/dev/null || true' EXIT

echo -n "Waiting for anvil JSON-RPC (eth_blockNumber) to be ready"
for i in $(seq 1 60); do
  if curl -s -X POST "$RPC_URL" -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | grep -q "result"; then
    echo " ready"
    break
  fi
  echo -n .
  sleep 0.5
done

if ! curl -s -X POST "$RPC_URL" -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | grep -q "result"; then
  echo "\nERROR: anvil did not become ready in time. Check $TMP_LOG" >&2
  exit 1
fi

echo "Deploying UnoLobby to local anvil..."

DEPLOY_OUTPUT=$(forge create contracts/UnoLobby.sol:UnoLobby --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --constructor-args "$DEV_WALLET" 2>&1)

echo "$DEPLOY_OUTPUT"

# try to extract deployed address
if echo "$DEPLOY_OUTPUT" | grep -q "Deployed to:"; then
  ADDR=$(echo "$DEPLOY_OUTPUT" | sed -n 's/.*Deployed to: \(0x[0-9a-fA-F]\{40\}\).*/\1/p' | tail -n1)
  echo "Contract deployed at: $ADDR"
else
  echo "Could not parse deployed address from forge output. See above." >&2
fi

echo "Done. Anvil will be stopped when this script exits." 
