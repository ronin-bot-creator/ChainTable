#!/bin/bash

# Script directo para ejecutar el test de refund en Ronin Mainnet

set -e  # Exit on error

# Cargar variables del .env manualmente
if [ -f .env ]; then
    export PRIVATE_KEY=$(grep "^PRIVATE_KEY=" .env | cut -d '=' -f2)
    export RPC_URL_RONIN=$(grep "^RPC_URL_RONIN=" .env | cut -d '=' -f2)
    export DEV_WALLET=$(grep "^DEV_WALLET=" .env | cut -d '=' -f2)
    export CONTRACT_ADDRESS=$(grep "^CONTRACT_ADDRESS=" .env | cut -d '=' -f2)
fi

echo "🧪 Ronin Mainnet Refund Test"
echo "============================="
echo ""

# Verificar variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY not found in .env"
    exit 1
fi

if [ -z "$RPC_URL_RONIN" ]; then
    echo "❌ RPC_URL_RONIN not found in .env"
    exit 1
fi

# Mostrar información
DEPLOYER=$(~/.foundry/bin/cast wallet address "$PRIVATE_KEY")
BALANCE=$(~/.foundry/bin/cast balance "$DEPLOYER" --rpc-url "$RPC_URL_RONIN")
BALANCE_RON=$(~/.foundry/bin/cast --to-unit "$BALANCE" ether)

echo "📍 Deployer: $DEPLOYER"
echo "💰 Balance: $BALANCE_RON RON (Mainnet)"
echo ""

if (( $(echo "$BALANCE_RON < 0.01" | bc -l) )); then
    echo "⚠️  Warning: Balance is low. You need at least ~0.01 RON for gas + entry fee"
    echo ""
fi

# Advertencia antes de ejecutar en mainnet
echo "⚠️  WARNING: This will deploy a NEW contract on Ronin MAINNET"
echo "   This uses REAL RON for gas and entry fee!"
echo ""
read -p "Continue? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

# Ejecutar el script
echo ""
echo "🚀 Executing test on Ronin Mainnet..."
echo ""

~/.foundry/bin/forge script script/TestRefundRonin.s.sol:TestRefundRonin \
    --rpc-url "$RPC_URL_RONIN" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    --legacy \
    -vvv

echo ""
echo "✅ Test completed on Ronin Mainnet!"
echo ""
echo "📊 View on Ronin Explorer:"
echo "https://app.roninchain.com/address/$DEPLOYER"
