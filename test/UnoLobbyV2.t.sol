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
}
