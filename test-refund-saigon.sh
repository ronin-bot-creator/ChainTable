#!/bin/bash

# Script directo para ejecutar el test de refund en Saigon (Ronin Testnet)

set -e  # Exit on error

# Cargar variables del .env manualmente
if [ -f .env ]; then
    export PRIVATE_KEY=$(grep "^PRIVATE_KEY=" .env | cut -d '=' -f2)
    export RPC_URL_RONIN_TESTNET=$(grep "^RPC_URL_RONIN_TESTNET=" .env | cut -d '=' -f2)
    export DEV_WALLET=$(grep "^DEV_WALLET=" .env | cut -d '=' -f2)
    export CONTRACT_ADDRESS=$(grep "^CONTRACT_ADDRESS=" .env | cut -d '=' -f2)
fi

echo "🧪 Saigon Testnet Refund Test"
echo "=============================="
echo ""

# Verificar variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY not found in .env"
    exit 1
fi

if [ -z "$RPC_URL_RONIN_TESTNET" ]; then
    echo "❌ RPC_URL_RONIN_TESTNET not found in .env"
    exit 1
fi

# Mostrar información
DEPLOYER=$(~/.foundry/bin/cast wallet address "$PRIVATE_KEY")
BALANCE=$(~/.foundry/bin/cast balance "$DEPLOYER" --rpc-url "$RPC_URL_RONIN_TESTNET")
BALANCE_RON=$(~/.foundry/bin/cast --to-unit "$BALANCE" ether)

echo "📍 Deployer: $DEPLOYER"
echo "💰 Balance: $BALANCE_RON RON (Saigon Testnet)"
echo ""

# Verificar si ya existe un contrato desplegado
if [ -n "$CONTRACT_ADDRESS" ]; then
    echo "📝 Using existing contract: $CONTRACT_ADDRESS"
    echo ""
fi

# Ejecutar el script
echo "🚀 Executing test on Saigon..."
echo ""

~/.foundry/bin/forge script script/TestRefundSaigon.s.sol:TestRefundSaigon \
    --rpc-url "$RPC_URL_RONIN_TESTNET" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    --legacy \
    -vvv

echo ""
echo "✅ Test completed on Saigon!"
echo ""
echo "📊 View on Saigon Explorer:"
echo "https://saigon-app.roninchain.com/address/$DEPLOYER"
