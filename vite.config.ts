import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The app is served by the Express server (see server/index.ts) which runs Vite in
// middleware mode, so everything lands on a single origin/port. That keeps the live
// preview simple and means the browser never needs to reach a second service.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 8787,
    allowedHosts: true, // the sandbox preview proxies via *.e2b.app
    cors: true,
    strictPort: false,
  },
  preview: { host: '0.0.0.0', port: Number(process.env.PORT) || 8787, allowedHosts: true },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1500 },
  optimizeDeps: { include: ['react', 'react-dom'] },
})
