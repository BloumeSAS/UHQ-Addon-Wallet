import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5174,
    proxy: {
      // En dev : proxifie les appels API + manifest vers NestJS
      '/api':              { target: 'http://localhost:3001', changeOrigin: true },
      '/uhq-manifest.json': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
