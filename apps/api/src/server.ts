// 📄 apps/api/src/server.ts
// Demarrage du serveur HTTP et de Socket.io. Ce fichier ne contient
// que ce qui touche au cycle de vie du processus : ecoute, arret propre.

import http from 'node:http';
import { Server as SocketServer } from 'socket.io';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';

const app = createApp();
const server = http.createServer(app);

// ⚡ Socket.io : diffusion des moments forts et du tableau de bord en direct.
export const io = new SocketServer(server, {
  cors: { origin: env.CLIENT_URL, credentials: true },
});

// 🔌 Injection de io dans chaque requete, pour que les controleurs emettent.
app.use((req, _res, next) => {
  req.io = io;
  next();
});

server.listen(env.PORT, () => {
  console.log(`🚀 API Memora sur le port ${env.PORT} (${env.NODE_ENV})`);
});

// 🛑 Arret propre : on ferme les connexions avant de rendre la main,
// sinon les requetes en cours sont coupees net au redeploiement.
async function shutdown(signal: string) {
  console.log(`\n${signal} recu, arret en cours...`);
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Declaration du champ io ajoute a la requete Express.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      io: SocketServer;
    }
  }
}
