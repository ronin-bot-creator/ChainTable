// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/UnoLobby.sol";

contract DeployRoninSaigon is Script {
    function run() external {
        // Cargar la private key del .env
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address devWallet = vm.envAddress("DEV_WALLET");
        
        console.log("Deploying to Ronin Saigon Testnet...");
        console.log("Deployer address:", vm.addr(deployerPrivateKey));
        console.log("Dev wallet:", devWallet);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy UnoLobby contract
        UnoLobby unoLobby = new UnoLobby(devWallet);
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Successful ===");
        console.log("UnoLobby deployed to:", address(unoLobby));
        console.log("Dev wallet set to:", devWallet);
        console.log("\nAdd this to your .env:");
        console.log("CONTRACT_ADDRESS_RONIN_SAIGON=%s", address(unoLobby));
        console.log("\nVerify on explorer:");
        console.log("https://saigon-app.roninchain.com/address/%s", address(unoLobby));
    }
}
