UnoLobby Hardhat scaffold

Quick start:

1. Install deps

   npm install

2. Run tests

   npx hardhat test

Environment variables (copy .env.example -> .env):

- SEPOLIA_RPC
- MUMBAI_RPC
- PRIVATE_KEY

Notes:
- Tests use a mock ERC20 contract for token flows.
- The contract requires a devWallet address at deploy time.
