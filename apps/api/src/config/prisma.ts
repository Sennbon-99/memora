// apps/api/src/config/prisma.ts
// Instance unique du client Prisma, partagee par toute l'application.
// En developpement, tsx recharge les modules a chaque sauvegarde : sans ce
// cache sur globalThis, on ouvrirait une nouvelle connexion a chaque fois
// jusqu'a saturer PostgreSQL.

import { PrismaClient } from '../../generated/prisma/index.js';
import { isProduction } from './env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['query', 'warn', 'error'],
  });

if (!isProduction) globalForPrisma.prisma = prisma;
