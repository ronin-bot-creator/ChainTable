// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {UnoLobbyV2} from "../contracts/UnoLobbyV2.sol";

/**
 * @title DeployUnoLobbyV2
 * @notice Script para deployar UnoLobbyV2 en Sepolia
 * @dev Uso:
 *      forge script script/DeployUnoLobbyV2.s.sol:DeployUnoLobbyV2 \
 *        --rpc-url $RPC_URL_SEPOLIA \
 *        --private-key $PRIVATE_KEY \
 *        --broadcast \
 *        --verify
 */
contract DeployUnoLobbyV2 is Script {
    function run() external returns (UnoLobbyV2) {
        // Leer devWallet desde variables de entorno
        address devWallet = vm.envAddress("DEV_WALLET");
        
        console.log("==============================================");
        console.log("Deploying UnoLobbyV2...");
        console.log("==============================================");
        console.log("Deployer:", msg.sender);
        console.log("Dev Wallet:", devWallet);
        console.log("Network:", block.chainid);
        console.log("");

        vm.startBroadcast();

        // Deploy del contrato
        UnoLobbyV2 unoLobby = new UnoLobbyV2(devWallet);

        vm.stopBroadcast();

        console.log("");
        console.log("==============================================");
        console.log("[OK] UnoLobbyV2 deployed at:", address(unoLobby));
        console.log("==============================================");
        console.log("");
        console.log("Configuracion:");
        console.log("  Owner:", unoLobby.owner());
        console.log("  Dev Wallet:", unoLobby.devWallet());
        console.log("  Fee Percentage:", unoLobby.FEE_PERCENTAGE(), "%");
        console.log("");
        console.log("==============================================");
        console.log("NEXT STEPS:");
        console.log("==============================================");
        console.log("1. Actualizar .env:");
        console.log("   CONTRACT_ADDRESS_SEPOLIA=", address(unoLobby));
        console.log("");
        console.log("2. Actualizar ABI en:");
        console.log("   - server/contractService.js");
        console.log("   - src/services/contractService.ts (si existe)");
        console.log("");
        console.log("3. Verificar en Etherscan:");
        console.log("   https://sepolia.etherscan.io/address/", address(unoLobby));
        console.log("==============================================");

        return unoLobby;
    }
}
