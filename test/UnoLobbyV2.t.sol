// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {UnoLobbyV2} from "../contracts/UnoLobbyV2.sol";

contract UnoLobbyV2Test is Test {
    UnoLobbyV2 public unoLobby;
    address public owner;
    address public devWallet;
    address public player1;
    address public player2;
    address public player3;

    uint256 constant ENTRY_FEE = 0.0001 ether;

    // Permitir que el contrato de test reciba ETH
    receive() external payable {}

    function setUp() public {
        owner = address(this);
        devWallet = makeAddr("devWallet");
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");
        player3 = makeAddr("player3");

        // Deploy contract
        unoLobby = new UnoLobbyV2(devWallet);

        // Fund players
        vm.deal(player1, 1 ether);
        vm.deal(player2, 1 ether);
        vm.deal(player3, 1 ether);
    }

    function test_CreateLobby() public {
        uint256 lobbyId = unoLobby.createLobby(
            address(0), // ETH nativo
            ENTRY_FEE,
            2, // 2 jugadores
            0  // BEAST mode
        );

        assertEq(lobbyId, 1);
        assertEq(unoLobby.lobbyCount(), 1);
    }

    function test_JoinLobby() public {
        // Crear lobby
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 2, 0);

        // Player 1 se une
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);

        address[] memory players = unoLobby.getLobbyPlayers(lobbyId);
        assertEq(players.length, 1);
        assertEq(players[0], player1);
    }

    function test_EndLobbyByAnyPlayer() public {
        // Crear lobby
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 2, 0);

        // Ambos jugadores se unen
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);

        // Player 2 distribuye premios (NO es el creador del lobby)
        address[] memory winners = new address[](1);
        winners[0] = player1;

        uint256 devBalanceBefore = devWallet.balance;
        uint256 player1BalanceBefore = player1.balance;

        vm.prank(player2); // Player 2 llama endLobby
        unoLobby.endLobby(lobbyId, winners);

        // Verificar que se distribuyeron correctamente
        uint256 totalPool = ENTRY_FEE * 2;
        uint256 fee = (totalPool * 5) / 100;
        uint256 prize = totalPool - fee;

        assertEq(devWallet.balance, devBalanceBefore + fee);
        assertEq(player1.balance, player1BalanceBefore + prize);
    }

    function test_EmergencyWithdraw() public {
        // Crear y llenar lobby
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 2, 0);
        
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);

        // Simular fondos atrapados (contract tiene balance)
        uint256 contractBalance = address(unoLobby).balance;
        assertGt(contractBalance, 0);

        // Owner retira fondos de emergencia
        uint256 ownerBalanceBefore = owner.balance;
        unoLobby.emergencyWithdraw(address(0), contractBalance);

        assertEq(address(unoLobby).balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + contractBalance);
    }

    function test_CannotEndLobbyIfNotPlayer() public {
        // Crear lobby
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 2, 0);

        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);

        // Player 3 (NO está en el lobby) intenta distribuir
        address[] memory winners = new address[](1);
        winners[0] = player1;

        vm.prank(player3);
        vm.expectRevert(UnoLobbyV2.NotAPlayer.selector);
        unoLobby.endLobby(lobbyId, winners);
    }

    function test_AutoStartWhenFull() public {
        // Crear lobby de 2 jugadores
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 2, 0);

        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        // Antes del segundo jugador, state = OPEN
        (, , , , , UnoLobbyV2.LobbyState stateBefore, , ) = unoLobby.getLobbyInfo(lobbyId);
        assertTrue(stateBefore == UnoLobbyV2.LobbyState.OPEN);

        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);

        // Después del segundo jugador, state = STARTED
        (, , , , , UnoLobbyV2.LobbyState stateAfter, , ) = unoLobby.getLobbyInfo(lobbyId);
        assertTrue(stateAfter == UnoLobbyV2.LobbyState.STARTED);
    }

    function test_SetDevWallet() public {
        address newDevWallet = makeAddr("newDevWallet");
        
        unoLobby.setDevWallet(newDevWallet);
        
        assertEq(unoLobby.devWallet(), newDevWallet);
    }

    // ============================================
    // REFUND TESTS
    // ============================================

    function test_CancelLobbyAndRefundAllPlayers() public {
        console.log("\n=== TEST: Cancel Lobby and Refund All Players ===");
        
        // Crear lobby
        console.log("\n1. Creating lobby...");
        vm.prank(player1);
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 4, 0);
        console.log("   Lobby ID:", lobbyId);
        console.log("   Entry fee:", ENTRY_FEE);
        
        // Guardar balances iniciales
        uint256 player1BalanceBefore = player1.balance;
        uint256 player2BalanceBefore = player2.balance;
        uint256 player3BalanceBefore = player3.balance;
        
        console.log("\n2. Initial balances:");
        console.log("   Player 1:", player1BalanceBefore);
        console.log("   Player 2:", player2BalanceBefore);
        console.log("   Player 3:", player3BalanceBefore);
        
        // Los jugadores se unen
        console.log("\n3. Players joining...");
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        console.log("   Player 1 joined");
        
        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        console.log("   Player 2 joined");
        
        vm.prank(player3);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        console.log("   Player 3 joined");
        
        // Verificar que el contrato tiene los fondos
        uint256 contractBalance = address(unoLobby).balance;
        console.log("\n4. Contract balance:", contractBalance);
        assertEq(contractBalance, ENTRY_FEE * 3, "Contract should have 3x entry fee");
        
        // Verificar número de jugadores
        address[] memory playersBefore = unoLobby.getLobbyPlayers(lobbyId);
        console.log("   Number of players:", playersBefore.length);
        assertEq(playersBefore.length, 3, "Should have 3 players");
        
        // Verificar estado del lobby
        (, , , , , UnoLobbyV2.LobbyState stateBefore, , ) = unoLobby.getLobbyInfo(lobbyId);
        assertTrue(stateBefore == UnoLobbyV2.LobbyState.OPEN, "Lobby should be OPEN");
        console.log("   Lobby state: OPEN");
        
        // Player1 (creador) cancela el lobby
        console.log("\n5. Cancelling lobby...");
        vm.prank(player1);
        unoLobby.cancelLobby(lobbyId);
        console.log("   Lobby cancelled by creator");
        
        // Verificar estado del lobby
        (, , , , , UnoLobbyV2.LobbyState stateAfter, , ) = unoLobby.getLobbyInfo(lobbyId);
        assertTrue(stateAfter == UnoLobbyV2.LobbyState.CANCELLED, "Lobby should be CANCELLED");
        console.log("   Lobby state: CANCELLED");
        
        // Verificar que el contrato devolvió todos los fondos
        uint256 contractBalanceAfter = address(unoLobby).balance;
        console.log("\n6. Contract balance after cancel:", contractBalanceAfter);
        assertEq(contractBalanceAfter, 0, "Contract should have returned all funds");
        
        // Verificar balances de los jugadores (deberían tener su dinero de vuelta)
        uint256 player1BalanceAfter = player1.balance;
        uint256 player2BalanceAfter = player2.balance;
        uint256 player3BalanceAfter = player3.balance;
        
        console.log("\n7. Final balances:");
        console.log("   Player 1:", player1BalanceAfter);
        console.log("   Player 2:", player2BalanceAfter);
        console.log("   Player 3:", player3BalanceAfter);
        
        // Los jugadores deberían tener exactamente su balance original
        assertEq(player1BalanceAfter, player1BalanceBefore, "Player 1 should get full refund");
        assertEq(player2BalanceAfter, player2BalanceBefore, "Player 2 should get full refund");
        assertEq(player3BalanceAfter, player3BalanceBefore, "Player 3 should get full refund");
        
        console.log("\n=== REFUND TEST PASSED! All players got their entry fee back ===\n");
    }

    function test_OnlyCreatorCanCancelLobby() public {
        console.log("\n=== TEST: Only Creator Can Cancel Lobby ===");
        
        // Player1 crea lobby
        vm.prank(player1);
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 4, 0);
        
        // Players se unen
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        // Player2 intenta cancelar (debería fallar)
        console.log("   Player 2 trying to cancel...");
        vm.prank(player2);
        vm.expectRevert("Only creator or owner can cancel");
        unoLobby.cancelLobby(lobbyId);
        
        console.log("   Correctly prevented non-creator from cancelling");
        console.log("\n=== TEST PASSED ===\n");
    }

    function test_OwnerCanCancelAnyLobby() public {
        console.log("\n=== TEST: Owner Can Cancel Any Lobby ===");
        
        // Player1 crea lobby
        vm.prank(player1);
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 4, 0);
        
        // Players se unen
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        uint256 contractBalanceBefore = address(unoLobby).balance;
        assertGt(contractBalanceBefore, 0);
        
        // Owner cancela (debería funcionar)
        console.log("   Owner cancelling lobby...");
        unoLobby.cancelLobby(lobbyId);
        
        // Verificar estado
        (, , , , , UnoLobbyV2.LobbyState state, , ) = unoLobby.getLobbyInfo(lobbyId);
        assertTrue(state == UnoLobbyV2.LobbyState.CANCELLED);
        
        // Verificar refund
        uint256 contractBalanceAfter = address(unoLobby).balance;
        assertEq(contractBalanceAfter, 0);
        
        console.log("   Owner successfully cancelled and refunded all players");
        console.log("\n=== TEST PASSED ===\n");
    }

    function test_CannotCancelStartedLobby() public {
        console.log("\n=== TEST: Cannot Cancel Started Lobby ===");
        
        // Crear lobby de 2 jugadores (auto-start)
        vm.prank(player1);
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 2, 0);
        
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        // Lobby auto-started, intentar cancelar debería fallar
        console.log("   Trying to cancel started lobby...");
        vm.prank(player1);
        vm.expectRevert(UnoLobbyV2.LobbyNotOpen.selector);
        unoLobby.cancelLobby(lobbyId);
        
        console.log("   Correctly prevented cancel after lobby started");
        console.log("\n=== TEST PASSED ===\n");
    }

    function test_RefundWithNoPlayers() public {
        console.log("\n=== TEST: Cancel Lobby With No Players ===");
        
        // Crear lobby sin jugadores
        vm.prank(player1);
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 4, 0);
        
        uint256 contractBalanceBefore = address(unoLobby).balance;
        
        // Cancelar lobby vacío
        console.log("   Cancelling empty lobby...");
        vm.prank(player1);
        unoLobby.cancelLobby(lobbyId);
        
        // Verificar estado
        (, , , , , UnoLobbyV2.LobbyState state, , ) = unoLobby.getLobbyInfo(lobbyId);
        assertTrue(state == UnoLobbyV2.LobbyState.CANCELLED);
        
        // Balance no debería cambiar (no había jugadores)
        uint256 contractBalanceAfter = address(unoLobby).balance;
        assertEq(contractBalanceAfter, contractBalanceBefore);
        
        console.log("   Empty lobby cancelled successfully");
        console.log("\n=== TEST PASSED ===\n");
    }

    function test_CancelWithSinglePlayer() public {
        console.log("\n=== TEST: Cancel Lobby With Single Player (Bug Reproduction) ===");
        
        // Crear lobby
        console.log("\n1. Player1 creates lobby...");
        vm.prank(player1);
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 4, 0);
        
        // Guardar balance inicial de player1
        uint256 player1BalanceBefore = player1.balance;
        console.log("   Player1 balance before join:", player1BalanceBefore);
        
        // Player1 se une a su propio lobby
        console.log("\n2. Player1 joins own lobby...");
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        console.log("   Player1 joined");
        
        // Verificar contrato tiene los fondos
        uint256 contractBalance = address(unoLobby).balance;
        console.log("\n3. Contract balance after join:", contractBalance);
        assertEq(contractBalance, ENTRY_FEE, "Contract should have entry fee");
        
        // Verificar jugadores
        address[] memory players = unoLobby.getLobbyPlayers(lobbyId);
        console.log("   Number of players:", players.length);
        assertEq(players.length, 1, "Should have 1 player");
        assertEq(players[0], player1, "Player should be player1");
        
        // Cancelar lobby
        console.log("\n4. Player1 cancels lobby...");
        vm.prank(player1);
        unoLobby.cancelLobby(lobbyId);
        console.log("   Lobby cancelled");
        
        // Verificar refund
        uint256 contractBalanceAfter = address(unoLobby).balance;
        uint256 player1BalanceAfter = player1.balance;
        
        console.log("\n5. After cancel:");
        console.log("   Contract balance:", contractBalanceAfter);
        console.log("   Player1 balance:", player1BalanceAfter);
        
        // CRITICAL: Contract debe tener 0 y player1 debe recuperar su dinero
        assertEq(contractBalanceAfter, 0, "Contract should refund all funds");
        assertEq(player1BalanceAfter, player1BalanceBefore, "Player1 should get full refund");
        
        console.log("\n=== TEST PASSED! Single player refund works ===\n");
    }

    function test_CancelWithTwoPlayers() public {
        console.log("\n=== TEST: Cancel Lobby With Two Players ===");
        
        // Crear lobby
        vm.prank(player1);
        uint256 lobbyId = unoLobby.createLobby(address(0), ENTRY_FEE, 4, 0);
        
        uint256 player1BalanceBefore = player1.balance;
        uint256 player2BalanceBefore = player2.balance;
        
        // Ambos jugadores se unen
        vm.prank(player1);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        vm.prank(player2);
        unoLobby.joinLobby{value: ENTRY_FEE}(lobbyId);
        
        // Verificar fondos en contrato
        assertEq(address(unoLobby).balance, ENTRY_FEE * 2, "Contract should have 2x entry fee");
        
        // Cancelar
        vm.prank(player1);
        unoLobby.cancelLobby(lobbyId);
        
        // Verificar refunds
        assertEq(address(unoLobby).balance, 0, "Contract should refund all");
        assertEq(player1.balance, player1BalanceBefore, "Player1 refunded");
        assertEq(player2.balance, player2BalanceBefore, "Player2 refunded");
        
        console.log("   Both players refunded successfully");
        console.log("\n=== TEST PASSED ===\n");
    }
}
