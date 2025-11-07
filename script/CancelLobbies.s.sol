// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../lib/forge-std/src/Script.sol";
import "../contracts/UnoLobby.sol";

/**
 * @title CancelAllLobbies
 * @notice Script para cancelar todos los lobbies y recuperar fondos atrapados
 * @dev Solo puede ejecutarlo el owner del contrato o direcciones autorizadas
 * 
 * INSTRUCCIONES DE USO:
 * 
 * 1. Cancelar lobbies específicos:
 *    forge script script/CancelLobbies.s.sol:CancelAllLobbies \
 *      --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY \
 *      --private-key YOUR_PRIVATE_KEY \
 *      --broadcast
 * 
 * 2. Solo simular (dry-run):
 *    forge script script/CancelLobbies.s.sol:CancelAllLobbies \
 *      --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
 * 
 * NOTA: Edita START_LOBBY_ID y END_LOBBY_ID según necesites
 */
contract CancelAllLobbies is Script {
    // Dirección del contrato en Sepolia
    address constant UNOLOLBY_ADDRESS = 0xC34055c565B5789f05dec44585f074d1009Feb89;
    
    // Rango de lobbies a cancelar
    // Según los logs, tienes hasta el lobby 18
    uint256 constant START_LOBBY_ID = 1;
    uint256 constant END_LOBBY_ID = 18;
    
    function run() external {
        // Obtener la private key del .env
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        UnoLobby lobby = UnoLobby(payable(UNOLOLBY_ADDRESS));
        
        console.log("==============================================");
        console.log("Cancelando lobbies en contrato:", UNOLOLBY_ADDRESS);
        console.log("Rango de lobbies:", START_LOBBY_ID, "a", END_LOBBY_ID);
        console.log("==============================================");
        
        uint256 totalCancelled = 0;
        uint256 totalFailed = 0;
        
        for (uint256 i = START_LOBBY_ID; i <= END_LOBBY_ID; i++) {
            try lobby.getLobbyPlayers(i) returns (address[] memory players) {
                if (players.length > 0) {
                    console.log("\nLobby", i, "- Jugadores:", players.length);
                    
                    // Intentar cancelar
                    try lobby.cancelLobby(i) {
                        console.log("  [OK] Lobby", i, "cancelado exitosamente");
                        totalCancelled++;
                    } catch Error(string memory reason) {
                        console.log("  [ERROR] Error cancelando lobby", i, ":", reason);
                        totalFailed++;
                    } catch {
                        console.log("  [ERROR] Error desconocido cancelando lobby", i);
                        totalFailed++;
                    }
                } else {
                    console.log("Lobby", i, "- Sin jugadores (ya finalizado o cancelado)");
                }
            } catch {
                // Lobby no existe o no se puede acceder
                console.log("Lobby", i, "- No accesible");
            }
        }
        
        vm.stopBroadcast();
        
        console.log("\n==============================================");
        console.log("RESUMEN:");
        console.log("  [OK] Lobbies cancelados:", totalCancelled);
        console.log("  [ERROR] Fallos:", totalFailed);
        console.log("==============================================");
    }
}

/**
 * @title CancelSpecificLobby
 * @notice Script para cancelar un lobby específico
 */
contract CancelSpecificLobby is Script {
    address constant UNOLOLBY_ADDRESS = 0xC34055c565B5789f05dec44585f074d1009Feb89;
    
    function run() external {
        // Obtener el lobby ID del entorno
        uint256 lobbyId = vm.envUint("LOBBY_ID");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        UnoLobby lobby = UnoLobby(payable(UNOLOLBY_ADDRESS));
        
        console.log("==============================================");
        console.log("Cancelando lobby:", lobbyId);
        console.log("Contrato:", UNOLOLBY_ADDRESS);
        console.log("==============================================");
        
        // Ver jugadores
        address[] memory players = lobby.getLobbyPlayers(lobbyId);
        console.log("Jugadores en el lobby:", players.length);
        for (uint256 i = 0; i < players.length; i++) {
            console.log("  -", players[i]);
        }
        
        // Cancelar
        console.log("\nCancelando lobby...");
        lobby.cancelLobby(lobbyId);
        
        console.log("[OK] Lobby cancelado exitosamente!");
        console.log("Los fondos han sido reembolsados a los jugadores.");
        
        vm.stopBroadcast();
    }
}

/**
 * @title CheckContractBalance
 * @notice Script para verificar el balance del contrato
 */
contract CheckContractBalance is Script {
    address constant UNOLOLBY_ADDRESS = 0xC34055c565B5789f05dec44585f074d1009Feb89;
    
    function run() external view {
        console.log("==============================================");
        console.log("Balance del contrato UnoLobby");
        console.log("Direccion:", UNOLOLBY_ADDRESS);
        console.log("==============================================");
        
        uint256 balance = UNOLOLBY_ADDRESS.balance;
        console.log("Balance:", balance, "wei");
        console.log("Balance:", balance / 1e18, "ETH (entero)");
        console.log("Balance:", balance / 1e15, "milli-ETH");
        
        // Calcular cuántos lobbies representa
        uint256 entryFee = 100000000000000; // 0.0001 ETH
        uint256 estimatedLobbies = balance / (entryFee * 2); // Asumiendo 2 jugadores por lobby
        console.log("\nFondos atrapados de ~", estimatedLobbies, "lobbies");
        console.log("(Asumiendo 2 jugadores x 0.0001 ETH cada uno)");
    }
}
