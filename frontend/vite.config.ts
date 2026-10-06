import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const api = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The dev server proxies the API so the browser sees one origin and the
    // session cookie stays first-party.
    proxy: { '/api': { target: api, changeOrigin: false } },
  },
  preview: { port: 4173, proxy: { '/api': { target: api } } },
  build: { sourcemap: true, target: 'es2022' },
})
