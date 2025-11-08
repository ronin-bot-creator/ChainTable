import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  base: '/',
  server: { port: 5173 },
  // 👇 Importante para React Router
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})