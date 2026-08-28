// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Le service worker se met a jour tout seul : un invite qui rouvre
      // l'application en pleine soiree ne doit pas rester sur une version
      // perimee sans le savoir.
      registerType: 'autoUpdate',
      manifest: {
        name: 'Memora',
        short_name: 'Memora',
        description: 'Vos invites deviennent le photographe',
        start_url: '/',
        display: 'standalone',
        background_color: '#131313',
        theme_color: '#B0741C',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Les photographies ne sont jamais mises en cache : elles sont
        // volumineuses, servies par adresse signee expirante, et l'invite
        // n'est de toute facon pas cense les revoir.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'polices', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // En developpement, le client appelle /api sur son propre port :
      // pas de CORS a configurer, et les cookies sont poses sur la meme
      // origine qu'en production.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
