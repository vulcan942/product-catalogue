import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  // Client only ever talks to our server; the proxy keeps that same-origin in dev.
  server: { proxy: { '/api': 'http://localhost:3001' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false },
})
