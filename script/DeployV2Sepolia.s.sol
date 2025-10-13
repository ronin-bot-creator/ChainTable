// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {UnoLobbyV2} from "../contracts/UnoLobbyV2.sol";

contract DeployV2Sepolia is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address devWallet = vm.envAddress("DEV_WALLET");
        
        vm.startBroadcast(deployerPrivateKey);
        
        UnoLobbyV2 unoLobbyV2 = new UnoLobbyV2(devWallet);
        
        vm.stopBroadcast();
        
        console.log("UnoLobbyV2 deployed to:", address(unoLobbyV2));
        console.log("Dev Wallet:", devWallet);
    }
}
