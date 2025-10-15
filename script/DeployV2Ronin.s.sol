// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../contracts/UnoLobbyV2.sol";

contract DeployV2Ronin is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address devWallet = vm.envAddress("DEV_WALLET");

        vm.startBroadcast(deployerPrivateKey);

        UnoLobbyV2 unoLobby = new UnoLobbyV2(devWallet);

        vm.stopBroadcast();

        console.log("UnoLobbyV2 deployed to Ronin Mainnet at:", address(unoLobby));
        console.log("Dev Wallet:", devWallet);
    }
}
