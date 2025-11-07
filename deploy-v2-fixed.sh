#!/bin/bash

# Script para desplegar la versión corregida de UnoLobbyV2 con refund mejorado

set -e

# Cargar variables del .env
if [ -f .env ]; then
    export PRIVATE_KEY=$(grep "^PRIVATE_KEY=" .env | cut -d '=' -f2)
    export RPC_URL_SEPOLIA=$(grep "^RPC_URL_SEPOLIA=" .env | cut -d '=' -f2)
    export RPC_URL_RONIN_TESTNET=$(grep "^RPC_URL_RONIN_TESTNET=" .env | cut -d '=' -f2)
    export RPC_URL_RONIN=$(grep "^RPC_URL_RONIN=" .env | cut -d '=' -f2)
    export DEV_WALLET=$(grep "^DEV_WALLET=" .env | cut -d '=' -f2)
fi

echo "🚀 Deploying UnoLobbyV2 (Fixed Refund Version)"
echo "=============================================="
echo ""

# Menu de selección
echo "Select deployment network:"
echo "1) Sepolia Testnet"
echo "2) Ronin Saigon Testnet"
echo "3) Ronin Mainnet"
echo "4) All networks (sequential)"
read -p "Enter option (1-4): " option

deploy_to_network() {
    local network_name=$1
    local rpc_url=$2
    local is_mainnet=$3
    
    echo ""
    echo "================================================"
    echo "Deploying to $network_name..."
    echo "================================================"
    
    if [ "$is_mainnet" = "true" ]; then
        echo "⚠️  WARNING: Deploying to MAINNET!"
        echo "   This will use REAL funds!"
        read -p "Continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Skipped $network_name"
            return
        fi
    fi
    
    # Desplegar
    ~/.foundry/bin/forge script script/DeployV2Sepolia.s.sol:DeployV2Sepolia \
        --rpc-url "$rpc_url" \
        --private-key "$PRIVATE_KEY" \
        --broadcast \
        --legacy \
        -vvv
    
    echo "✅ Deployed to $network_name"
}

case $option in
    1)
        deploy_to_network "Sepolia" "$RPC_URL_SEPOLIA" "false"
        ;;
    2)
        deploy_to_network "Ronin Saigon (Testnet)" "$RPC_URL_RONIN_TESTNET" "false"
        ;;
    3)
        deploy_to_network "Ronin Mainnet" "$RPC_URL_RONIN" "true"
        ;;
    4)
        echo "Deploying to all networks..."
        deploy_to_network "Sepolia" "$RPC_URL_SEPOLIA" "false"
        deploy_to_network "Ronin Saigon" "$RPC_URL_RONIN_TESTNET" "false"
        deploy_to_network "Ronin Mainnet" "$RPC_URL_RONIN" "true"
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "================================================"
echo "✅ Deployment completed!"
echo "================================================"
echo ""
echo "Remember to:"
echo "1. Update .env with new contract addresses"
echo "2. Update frontend (Lobbies.tsx and useGame.ts)"
echo "3. Test refund functionality on each network"
