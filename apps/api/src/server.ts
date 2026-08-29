// apps/api/src/server.ts
// Demarrage du serveur HTTP et de Socket.io. Ce fichier ne contient
// que ce qui touche au cycle de vie du processus : ecoute, arret propre.

import http from 'node:http';
import { Server as SocketServer } from 'socket.io';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';
import { setupRealtime } from './realtime/socket.js';

const app = createApp();
const server = http.createServer(app);

// Socket.io : diffusion des moments forts et du tableau de bord en direct.
export const io = new SocketServer(server, {
  cors: { origin: env.CLIENT_URL, credentials: true },
});

// Les clients rejoignent la salle de leur evenement, apres verification
// de leurs droits : sans cela, les emissions des controleurs partiraient
// dans le vide.
setupRealtime(io);

// Mise a disposition de io pour les controleurs.
//
// Un app.use enregistre ici serait ajoute APRES le routeur monte dans
// createApp : Express execute les middlewares dans l'ordre d'enregistrement,
// l'injection ne se serait donc jamais executee. C'est le defaut qui faisait
// echouer la confirmation de photographie contre la vraie infrastructure.
// app.set, lui, ne depend d'aucun ordre : les controleurs lisent l'instance
// au moment de la requete, via emitToEvent.
app.set('io', io);

server.listen(env.PORT, () => {
  console.log(` API Memora sur le port ${env.PORT} (${env.NODE_ENV})`);
});

// Arret propre : on ferme les connexions avant de rendre la main,
// sinon les requetes en cours sont coupees net au redeploiement.
async function shutdown(signal: string) {
  console.log(`\n${signal} recu, arret en cours...`);
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

