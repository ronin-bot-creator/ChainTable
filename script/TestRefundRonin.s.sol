// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {UnoLobbyV2} from "../contracts/UnoLobbyV2.sol";

/**
 * @title TestRefundRonin
 * @notice Script para probar la funcionalidad de refund on-chain en Ronin Mainnet
 * @dev Este script:
 *      1. Despliega o usa contrato existente
 *      2. Crea un lobby con entry fee
 *      3. Une jugadores al lobby
 *      4. Cancela el lobby
 *      5. Verifica que los fondos fueron devueltos
 */
contract TestRefundRonin is Script {
    UnoLobbyV2 public unoLobby;
    
    // Entry fee para el test (0.001 RON)
    uint256 constant ENTRY_FEE = 0.001 ether;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address devWallet = vm.envAddress("DEV_WALLET");
        
        // Usar contrato existente o desplegar nuevo
        address contractAddress = vm.envOr("CONTRACT_ADDRESS", address(0));
        
        console.log("\n=== Ronin Mainnet Refund Test ===");
        console.log("Deployer address:", deployer);
        console.log("Dev wallet:", devWallet);
        console.log("Deployer balance:", deployer.balance / 1e18, "RON");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Si no hay contrato, desplegarlo
        if (contractAddress == address(0)) {
            console.log("\n1. Deploying UnoLobbyV2...");
            unoLobby = new UnoLobbyV2(devWallet);
            console.log("   Contract deployed at:", address(unoLobby));
        } else {
            console.log("\n1. Using existing contract:", contractAddress);
            unoLobby = UnoLobbyV2(payable(contractAddress));
        }
        
        // Guardar balance inicial
        uint256 balanceBefore = deployer.balance;
        console.log("\n2. Initial deployer balance:", balanceBefore / 1e18, "RON");
        console.log("   (", balanceBefore, "wei )");
        
        // Crear lobby
        console.log("\n3. Creating lobby...");
        console.log("   Entry fee:", ENTRY_FEE / 1e18, "RON");
        console.log("   Max players: 4");
        console.log("   Mode: BEAST (0)");
        
        uint256 lobbyId = unoLobby.createLobby(
            address(0),  // RON nativo
            ENTRY_FEE,
            4,           // max players
            0            // BEAST mode
        );
        
        console.log("   Lobby created with ID:", lobbyId);
        
        // Unirse al lobby
        console.log("\n4. Joining lobby...");
        console.log("   Sending", ENTRY_FEE / 1e18, "RON to join...");
        
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        console.log("   Successfully joined!");
        
        // Verificar estado del lobby
        console.log("\n5. Contract balance after join:", address(unoLobby).balance / 1e18, "RON");
        
        // Verificar players
        address[] memory players = unoLobby.getLobbyPlayers(lobbyId);
        console.log("\n6. Lobby info:");
        console.log("   Players:", players.length);
        
        // Cancelar lobby
        console.log("\n7. Cancelling lobby...");
        unoLobby.cancelLobby(lobbyId);
        console.log("   Lobby cancelled!");
        
        // Verificar estado después de cancelar
        console.log("\n8. Contract balance after cancel:", address(unoLobby).balance / 1e18, "RON");
        
        vm.stopBroadcast();
        
        // Verificaciones finales
        require(address(unoLobby).balance == 0, "Contract should have 0 balance after refund");
        
        console.log("\n=== TEST PASSED! ===");
        console.log("The entry fee was successfully refunded!");
        console.log("Contract balance is 0 and lobby is CANCELLED.");
        console.log("\nView on Ronin Explorer:");
        console.log("https://app.roninchain.com/address/", address(unoLobby));
        console.log("\nSave this address to .env:");
        console.log("CONTRACT_ADDRESS_RONIN=", address(unoLobby));
    }
}
