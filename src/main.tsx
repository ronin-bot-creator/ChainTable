import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'
import merge from 'lodash.merge'
import '@rainbow-me/rainbowkit/styles.css'

import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  sepolia,
} from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ronin, roninSaigon, abstract } from './chains'
import { BrowserRouter } from "react-router-dom";


const queryClient = new QueryClient()

// ⚠️ Necesitás un projectId de WalletConnect Cloud (gratis)
// https://cloud.walletconnect.com/
const config = getDefaultConfig({
  appName: 'Chain Table',
  projectId: 'f07abaf1c72667be12516c80f07650ff',
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia, ronin, roninSaigon, abstract],
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
        <RainbowKitProvider theme={myTheme}>
          <BrowserRouter>
          <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
