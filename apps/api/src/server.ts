// 📄 apps/api/src/server.ts
// Point d'entree de l'API. L'ordre des middlewares n'est pas decoratif :
// chaque ligne doit etre placee ou elle est, et les commentaires disent pourquoi.

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketServer } from 'socket.io';

import { env, isProduction } from './config/env.js';
import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRouter } from './routes/authRoute.js';

const app = express();
const server = http.createServer(app);

// ⚡ Socket.io : diffusion des moments forts et du tableau de bord en direct.
export const io = new SocketServer(server, {
  cors: { origin: env.CLIENT_URL, credentials: true },
});

// ⚠️ Le webhook Stripe doit recevoir le corps BRUT pour que sa signature
// puisse etre verifiee. Il est donc monte AVANT express.json(), qui
// transformerait le corps et invaliderait la signature.
// (route ajoutee avec le module paiement)

// 🌐 Middlewares globaux
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' })); // aucune image ne transite ici
app.use(cookieParser());
app.use(globalLimiter);

// 🔌 Injection de io dans la requete, pour que les controleurs puissent emettre.
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// ❤️ Sonde de vitalite : verifie l'API, la base et Redis.
// C'est elle que Coolify interroge avant de basculer le trafic sur une
// nouvelle version : si elle echoue, le deploiement est annule.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

// 🛣️ Routes de l'API
app.use('/api/auth', authRouter);

// 🧯 Intercepteur d'erreurs : toujours en dernier, apres toutes les routes.
app.use(errorHandler);

// 🚀 Demarrage
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
