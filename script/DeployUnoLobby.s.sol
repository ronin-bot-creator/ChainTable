// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../lib/forge-std/src/Script.sol";
import "../contracts/UnoLobby.sol";

contract DeployUnoLobbyScript is Script {
    function run() external {
        // set via environment: DEV_WALLET and PRIVATE_KEY
    address dev = vm.envAddress("DEV_WALLET");
    uint256 pk = vm.envUint("PRIVATE_KEY");
    vm.startBroadcast(pk);
    UnoLobby l = new UnoLobby(dev);
    console.log("Deployed UnoLobby at", address(l));
        vm.stopBroadcast();
    }
}
