#!/bin/bash

# Script directo para ejecutar el test de refund en Sepolia

set -e  # Exit on error

# Cargar variables del .env manualmente
if [ -f .env ]; then
    export PRIVATE_KEY=$(grep "^PRIVATE_KEY=" .env | cut -d '=' -f2)
    export RPC_URL_SEPOLIA=$(grep "^RPC_URL_SEPOLIA=" .env | cut -d '=' -f2)
    export DEV_WALLET=$(grep "^DEV_WALLET=" .env | cut -d '=' -f2)
    export CONTRACT_ADDRESS=$(grep "^CONTRACT_ADDRESS=" .env | cut -d '=' -f2)
fi

echo "🧪 Sepolia Refund Test"
echo "======================"
echo ""

# Verificar variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY not found in .env"
    exit 1
fi

if [ -z "$RPC_URL_SEPOLIA" ]; then
    echo "❌ RPC_URL_SEPOLIA not found in .env"
    exit 1
fi

# Mostrar información
DEPLOYER=$(~/.foundry/bin/cast wallet address "$PRIVATE_KEY")
BALANCE=$(~/.foundry/bin/cast balance "$DEPLOYER" --rpc-url "$RPC_URL_SEPOLIA")
BALANCE_ETH=$(~/.foundry/bin/cast --to-unit "$BALANCE" ether)

echo "📍 Deployer: $DEPLOYER"
echo "💰 Balance: $BALANCE_ETH ETH"
echo ""

# Verificar si ya existe un contrato desplegado
if [ -n "$CONTRACT_ADDRESS" ]; then
    echo "📝 Using existing contract: $CONTRACT_ADDRESS"
    echo ""
fi

# Ejecutar el script
echo "🚀 Executing test..."
echo ""

~/.foundry/bin/forge script script/TestRefundSepolia.s.sol:TestRefundSepolia \
    --rpc-url "$RPC_URL_SEPOLIA" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    -vvv

echo ""
echo "✅ Test completed!"
echo ""
echo "📊 View transactions on Sepolia Etherscan"
