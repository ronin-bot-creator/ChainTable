import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'
import merge from 'lodash.merge'
import '@rainbow-me/rainbowkit/styles.css'

import {
  RainbowKitProvider,
  darkTheme,
  getDefaultWallets,
} from '@rainbow-me/rainbowkit'
import { WagmiProvider, createConfig, http } from 'wagmi'
import {
  sepolia,
} from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ronin, roninSaigon, abstract } from './chains'
import { BrowserRouter } from "react-router-dom";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Deshabilitar ENS queries automáticas que usan eth.merkle.io
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

// Configurar connectors de wallets
const { connectors } = getDefaultWallets({
  appName: 'Chain Table',
  projectId: 'f07abaf1c72667be12516c80f07650ff',
})

// Configuración custom con transportes específicos (evita eth.merkle.io)
// Solo incluir chains que realmente uses
const config = createConfig({
  chains: [sepolia, ronin, roninSaigon, abstract],
  connectors,
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC || 'https://rpc.sepolia.org'),
    [ronin.id]: http(import.meta.env.VITE_RONIN_RPC || 'https://api.roninchain.com/rpc'),
    [roninSaigon.id]: http(import.meta.env.VITE_RONIN_SAIGON_RPC || 'https://saigon-testnet.roninchain.com/rpc'),
    [abstract.id]: http(),
  },
  ssr: false,
})

// 👇 inferimos el tipo desde darkTheme()
type RainbowTheme = ReturnType<typeof darkTheme>

const myTheme: RainbowTheme = merge(darkTheme(), {
  colors: {
    accentColor: '#4765a0ff',
    accentColorForeground: '#ffffff',
    modalBackground: '#0f172a',
    menuItemBackground: '#757981ff',

    // 👇 fuerza todo a blanco
    modalText: '#ffffff',
    modalTextSecondary: '#ffffff',
    modalTextDim: '#ffffff',
    generalBorderDim: '#ffffff',
    standby: '#ffffff',
  },
  radii: {
    connectButton: '0.75rem',
    modal: '1rem',
  },
})





ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={myTheme}
          showRecentTransactions={false}
        >
          <BrowserRouter>
          <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
