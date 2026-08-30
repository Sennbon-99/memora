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
        background_color: '#141019',
        theme_color: '#141019',
        // Ces trois adresses ne pointaient sur aucun fichier : le manifeste
        // annoncait des icones qui n'ont jamais existe, et le systeme
        // retombait sur une capture de la page a l'installation.
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icone-512-masquable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Les photographies ne sont jamais mises en cache : elles sont
        // volumineuses, servies par adresse signee expirante, et l'invite
        // n'est de toute facon pas cense les revoir.
        navigateFallbackDenylist: [/^\/api/],
        // Les polices sont servies par l'application elle-meme et deja
        // precachees avec le reste des ressources : la regle qui mettait en
        // cache fonts.googleapis.com ne s'appliquait a rien, l'application
        // n'ayant jamais appele ce domaine.
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
