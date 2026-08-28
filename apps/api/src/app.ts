// apps/api/src/app.ts
// Construction de l'application Express, sans demarrage.
//
// Cette separation a un but precis : les tests d'integration importent app
// et l'attaquent directement avec Supertest, sans ouvrir de port ni lancer
// de vrai serveur. Les tests deviennent rapides et peuvent tourner en parallele.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiRouter } from './router.js';
import { stripeWebhookRouter } from './features/payments/payment.routes.js';

export function createApp() {
  const app = express();

  // Le webhook Stripe recoit le corps BRUT. Il est monte ici, avant
  // express.json(), qui transformerait le corps et rendrait la verification
  // de signature impossible. L ordre de ces deux lignes n est pas negociable.
  app.use('/api/stripe', stripeWebhookRouter);

  // Middlewares globaux
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' })); // aucune image ne transite ici
  app.use(cookieParser());
  app.use(globalLimiter);

  // Sonde de vitalite : verifie l'API, la base et Redis.
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

  app.use('/api', apiRouter);

  // Intercepteur d'erreurs : toujours en dernier, apres toutes les routes.
  app.use(errorHandler);

  return app;
}
