import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config. The dev server also proxies /api to the FastAPI backend so the
// same app works in "static data" mode (default) and "live API" mode.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
  },
})
