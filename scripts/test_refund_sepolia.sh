#!/bin/bash

# Script para probar refund en Sepolia
# Carga automáticamente las variables del .env

# Cargar variables del .env
if [ -f .env ]; then
    echo "📄 Loading .env file..."
    export $(grep -v '^#' .env | xargs)
fi

echo "🧪 Testing Refund on Sepolia"
echo "================================"
echo ""

# Verificar que existen las variables necesarias
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY no está configurada en .env"
    exit 1
fi

# Usar RPC_URL_SEPOLIA del .env
if [ -z "$RPC_URL_SEPOLIA" ]; then
    echo "❌ Error: RPC_URL_SEPOLIA no está configurada en .env"
    exit 1
fi

SEPOLIA_RPC_URL="$RPC_URL_SEPOLIA"

# Mostrar dirección del deployer
DEPLOYER=$(cast wallet address "$PRIVATE_KEY")
echo "📍 Deployer address: $DEPLOYER"

# Verificar balance
BALANCE=$(cast balance "$DEPLOYER" --rpc-url "$SEPOLIA_RPC_URL")
BALANCE_ETH=$(cast --to-unit "$BALANCE" ether)
echo "💰 Balance: $BALANCE_ETH ETH"
echo ""

if (( $(echo "$BALANCE_ETH < 0.001" | bc -l) )); then
    echo "⚠️  Warning: Balance is low. You might need more Sepolia ETH"
    echo "Get free Sepolia ETH from: https://sepoliafaucet.com/"
    echo ""
fi

# Preguntar si usar contrato existente o desplegar nuevo
echo "Options:"
echo "1) Deploy new contract and test"
echo "2) Use existing contract"
read -p "Choose option (1 or 2): " option

if [ "$option" = "2" ]; then
    read -p "Enter contract address: " CONTRACT_ADDRESS
    export CONTRACT_ADDRESS
fi

echo ""
echo "🚀 Running test script..."
echo ""

# Ejecutar el script de Foundry
~/.foundry/bin/forge script script/TestRefundSepolia.s.sol:TestRefundSepolia \
    --rpc-url "$SEPOLIA_RPC_URL" \
    --broadcast \
    --verify \
    -vvvv

echo ""
echo "✅ Test completed!"
echo ""
echo "Check the transaction on Sepolia Etherscan"
