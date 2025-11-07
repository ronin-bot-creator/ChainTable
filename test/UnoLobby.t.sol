// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../lib/forge-std/src/Test.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "../lib/forge-std/src/Vm.sol";

import "../contracts/UnoLobby.sol";
import "../contracts/MockERC20.sol";

contract UnoLobbyTest is Test {
    UnoLobby public lobby;
    MockERC20 public token;
    address dev = address(0xBEEF);

    address alice = address(0x1001);
    address bob = address(0x1002);
    address carol = address(0x1003);
    address dave = address(0x1004);

    function setUp() public {
        token = new MockERC20("MockWETH", "WETH", 18);
        lobby = new UnoLobby(dev);

        // fund players with native and token for tests
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
        vm.deal(dave, 10 ether);

        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
        token.mint(carol, 1000 ether);
        token.mint(dave, 1000 ether);
    }

    function testBeastNativePayout() public {
        // Create lobby: native token, entryFee 1 ether, maxPlayers 3, BEAST
        uint256 id = lobby.createLobby(address(0), 1 ether, 3, UnoLobby.Mode.BEAST);

        // alice joins by sending native
        vm.prank(alice);
        lobby.joinLobby{value: 1 ether}(id);
        vm.prank(bob);
        lobby.joinLobby{value: 1 ether}(id);
        vm.prank(carol);
        lobby.joinLobby{value: 1 ether}(id);

    // total = 3 ether, fee = 5% = 0.15 ether, remainder = 2.85 -> winner gets remainder
        address[] memory winners = new address[](1);
        winners[0] = alice;

        // check balances before
        uint256 devBefore = address(dev).balance;
        uint256 aliceBefore = alice.balance;

        vm.prank(address(this)); // authorized caller
        lobby.setAuthorized(address(this), true);

        vm.prank(address(this));
        lobby.endLobby(id, winners);

        uint256 total = 3 ether;
        uint256 fee = (total * 5) / 100;
        uint256 remainder = total - fee;
        assertEq(address(dev).balance, devBefore + fee);
        assertEq(alice.balance, aliceBefore + remainder);
    }

    function testClassicERC20Distribution() public {
        // Create lobby: ERC20 token, entryFee 100 tokens, maxPlayers 3, CLASSIC
        uint256 id = lobby.createLobby(address(token), 100 ether, 3, UnoLobby.Mode.CLASSIC);

        // Players approve and join
        vm.prank(alice);
        token.approve(address(lobby), 100 ether);
        vm.prank(alice);
        lobby.joinLobby(id);

        vm.prank(bob);
        token.approve(address(lobby), 100 ether);
        vm.prank(bob);
        lobby.joinLobby(id);

        vm.prank(carol);
        token.approve(address(lobby), 100 ether);
        vm.prank(carol);
        lobby.joinLobby(id);

    // total = 300 tokens, fee = 15 (5%), remainder = 285
    // p1= (285*60)/100 = 171
    // p2= (285*20)/100 = 57
    // p3= (285*15)/100 = 42.75 (in wei units it's 42.75 * 1e18)

        address[] memory winners = new address[](3);
        winners[0] = alice;
        winners[1] = bob;
        winners[2] = carol;

    // record balances
    uint256 devBefore = token.balanceOf(dev);
    uint256 aliceBefore = token.balanceOf(alice);
    uint256 bobBefore = token.balanceOf(bob);
    uint256 carolBefore = token.balanceOf(carol);

        vm.prank(address(this));
        lobby.setAuthorized(address(this), true);

        vm.prank(address(this));
        lobby.endLobby(id, winners);

        uint256 total = 300 ether;
        uint256 fee = (total * 5) / 100; // 15 ether
        uint256 remainder = total - fee; // 285 ether
        uint256 p1 = (remainder * 60) / 100; // 171 ether
        uint256 p2 = (remainder * 20) / 100; // 57 ether
        uint256 p3 = (remainder * 15) / 100; // 42.75 ether (represented in wei)
        uint256 distributed = p1 + p2 + p3;
        uint256 leftover = remainder - distributed;

        assertEq(token.balanceOf(alice), aliceBefore + p1);
        assertEq(token.balanceOf(bob), bobBefore + p2);
        assertEq(token.balanceOf(carol), carolBefore + p3);
        assertEq(token.balanceOf(dev), devBefore + fee + leftover);
    }

    function testCancelLobbyRefunds() public {
        uint256 id = lobby.createLobby(address(0), 1 ether, 3, UnoLobby.Mode.BEAST);
        vm.prank(alice);
        lobby.joinLobby{value: 1 ether}(id);
        vm.prank(bob);
        lobby.joinLobby{value: 1 ether}(id);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(address(this));
        lobby.setAuthorized(address(this), true);

        vm.prank(address(this));
        lobby.cancelLobby(id);

        assertEq(alice.balance, aliceBefore + 1 ether);
        assertEq(bob.balance, bobBefore + 1 ether);
    }
}
