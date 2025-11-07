// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {UnoLobbyV2} from "../contracts/UnoLobbyV2.sol";

/**
 * @title TestRefundSepolia
 * @notice Script para probar la funcionalidad de refund on-chain en Sepolia
 * @dev Este script:
 *      1. Crea un lobby con entry fee
 *      2. Une jugadores al lobby
 *      3. Cancela el lobby
 *      4. Verifica que los fondos fueron devueltos
 */
contract TestRefundSepolia is Script {
    UnoLobbyV2 public unoLobby;
    
    // Entry fee para el test (0.0001 ETH = 100000 Gwei)
    uint256 constant ENTRY_FEE = 0.0001 ether;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Usar contrato existente o desplegar nuevo
        address contractAddress = vm.envOr("CONTRACT_ADDRESS", address(0));
        
        console.log("\n=== Sepolia Refund Test ===");
        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance / 1e18, "ETH");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Si no hay contrato, desplegarlo
        if (contractAddress == address(0)) {
            console.log("\n1. Deploying UnoLobbyV2...");
            unoLobby = new UnoLobbyV2(deployer); // deployer es dev wallet
            console.log("   Contract deployed at:", address(unoLobby));
        } else {
            console.log("\n1. Using existing contract:", contractAddress);
            unoLobby = UnoLobbyV2(payable(contractAddress));
        }
        
        // Guardar balance inicial
        uint256 balanceBefore = deployer.balance;
        console.log("\n2. Initial deployer balance:", balanceBefore / 1e18, "ETH");
        console.log("   (", balanceBefore, "wei )");
        
        // Crear lobby
        console.log("\n3. Creating lobby...");
        console.log("   Entry fee:", ENTRY_FEE / 1e18, "ETH");
        console.log("   Max players: 4");
        console.log("   Mode: BEAST (0)");
        
        uint256 lobbyId = unoLobby.createLobby(
            address(0),  // ETH nativo
            ENTRY_FEE,
            4,           // max players
            0            // BEAST mode
        );
        
        console.log("   Lobby created with ID:", lobbyId);
        
        // Unirse al lobby
        console.log("\n4. Joining lobby...");
        console.log("   Sending", ENTRY_FEE / 1e18, "ETH to join...");
        
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        console.log("   Successfully joined!");
        
        // Verificar estado del lobby
        uint256 contractBalance = address(unoLobby).balance;
        console.log("\n5. Contract balance after join:", contractBalance / 1e18, "ETH");
        console.log("   (", contractBalance, "wei )");
        
        (
            address creator,
            address token,
            uint256 entryFee,
            uint16 maxPlayers,
            UnoLobbyV2.PaymentMode mode,
            UnoLobbyV2.LobbyState state,
            address[] memory players,
            uint256 createdAt
        ) = unoLobby.getLobbyInfo(lobbyId);
        
        console.log("\n6. Lobby info:");
        console.log("   Creator:", creator);
        console.log("   State:", uint8(state), "(0=OPEN, 1=STARTED, 2=ENDED, 3=CANCELLED)");
        console.log("   Players:", players.length);
        console.log("   Entry fee:", entryFee / 1e18, "ETH");
        
        // Cancelar lobby
        console.log("\n7. Cancelling lobby...");
        unoLobby.cancelLobby(lobbyId);
        console.log("   Lobby cancelled!");
        
        // Verificar estado después de cancelar
        (, , , , , UnoLobbyV2.LobbyState stateAfter, , ) = unoLobby.getLobbyInfo(lobbyId);
        console.log("\n8. Lobby state after cancel:", uint8(stateAfter));
        
        uint256 contractBalanceAfter = address(unoLobby).balance;
        console.log("   Contract balance after cancel:", contractBalanceAfter / 1e18, "ETH");
        console.log("   (", contractBalanceAfter, "wei )");
        
        vm.stopBroadcast();
        
        // Verificar balance final (después de parar broadcast para evitar contar gas)
        uint256 balanceAfter = deployer.balance;
        console.log("\n9. Final deployer balance:", balanceAfter / 1e18, "ETH");
        console.log("   (", balanceAfter, "wei )");
        
        // Calcular diferencia (debería ser solo el gas gastado, no el entry fee)
        console.log("\n10. Balance comparison:");
        console.log("    Before:", balanceBefore, "wei");
        console.log("    After:", balanceAfter, "wei");
        
        if (balanceAfter < balanceBefore) {
            uint256 spent = balanceBefore - balanceAfter;
            console.log("    Spent (gas only):", spent, "wei");
            console.log("    This should be approximately equal to gas costs only.");
            console.log("    Entry fee was refunded!");
        } else {
            console.log("    Balance increased or stayed same (unexpected)");
        }
        
        // Verificaciones finales
        require(stateAfter == UnoLobbyV2.LobbyState.CANCELLED, "Lobby should be CANCELLED");
        require(contractBalanceAfter == 0, "Contract should have 0 balance after refund");
        
        console.log("\n=== TEST PASSED! ===");
        console.log("The entry fee was successfully refunded!");
        console.log("Contract balance is 0 and lobby is CANCELLED.");
        console.log("\nView on Sepolia Etherscan:");
        console.log("https://sepolia.etherscan.io/address/", address(unoLobby));
    }
}
