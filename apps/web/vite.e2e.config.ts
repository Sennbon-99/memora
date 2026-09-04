import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.js';

export default mergeConfig(base, defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3100', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3100', ws: true, changeOrigin: true },
    },
  },
}));
