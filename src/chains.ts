import type { Chain } from 'wagmi/chains'

// ⚡ Ronin Mainnet
export const ronin = {
  id: 2020,
  name: 'Ronin',
  nativeCurrency: {
    name: 'Ronin',
    symbol: 'RON',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://api.roninchain.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Ronin Explorer', url: 'https://app.roninchain.com/' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 30831888,
    },
  },
} as const satisfies Chain

// ⚡ Ronin Saigon Testnet
export const roninSaigon = {
  id: 2021,
  name: 'Ronin Saigon Testnet',
  nativeCurrency: {
    name: 'Ronin',
    symbol: 'RON',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://saigon-testnet.roninchain.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Saigon Explorer', url: 'https://saigon-app.roninchain.com/' },
  },
  testnet: true,
} as const satisfies Chain

// ⚡ Abstract Mainnet
export const abstract = {
  id: 2741,
  name: 'Abstract',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.abstract.org'] },
  },
  blockExplorers: {
    default: { name: 'Abstract Explorer', url: 'https://explorer.abstract.org' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 1,
    },
  },
  // iconUrl removed because it is not part of the `Chain` type from wagmi
  // Keep other properties compatible with the Chain type
} as const satisfies Chain

// ⚡ Sepolia (testnet)
export const sepolia = {
  id: 11155111,
  name: 'Sepolia',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://sepolia.infura.io/v3/'] }, // podés usar Alchemy/Infura
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 751532,
    },
  },
} as const satisfies Chain
