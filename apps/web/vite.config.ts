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
        // Le carnet de la marque (--color-pap de papier.css) : c'est ce que
        // montre l'ecran de lancement d'une application installee depuis
        // le navigateur. La balise theme-color, elle, suit le carnet de la
        // soiree a l'execution ; ici c'est seulement le premier instant.
        background_color: '#f5f2ea',
        theme_color: '#f5f2ea',
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
        // Ni l'API, ni /.well-known : ce dossier porte le fichier que
        // l'iPhone lit pour les liens universels, et il doit venir de nginx.
        navigateFallbackDenylist: [/^\/api/, /^\/\.well-known/],
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
      // Le temps reel passe par la meme origine que la page. Sans ce relais,
      // socket.io tape sur le serveur de developpement, recoit l'index HTML,
      // echoue, et recommence sans fin : la page finit par se figer.
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
});
