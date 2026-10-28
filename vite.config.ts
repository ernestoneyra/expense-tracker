import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API sees the address the browser used (localhost:5180), not its own: sign-in is an OAuth flow
// whose redirect address, token issuer and same-origin check are all worked out from that address.
const api = { target: 'http://localhost:5181', changeOrigin: false }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      '/api': api,
      '/.well-known': api,
    },
  },
})
