import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const API_PORT = process.env.API_PORT || '8787';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    // The sandbox exposes the dev server through *.prod-runtime.all-hands.dev hosts.
    allowedHosts: ['.all-hands.dev', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
