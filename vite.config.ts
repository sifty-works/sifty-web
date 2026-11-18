import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const siftyPort = process.env['SIFTY_API_PORT'] ?? '7300'
const siftyOrigin = `http://127.0.0.1:${siftyPort}`

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: siftyOrigin,
        changeOrigin: true,
        headers: {
          Origin: siftyOrigin,
        },
      },
    },
  },
})
