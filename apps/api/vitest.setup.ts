// apps/api/vitest.setup.ts
// Variables d'environnement des tests, posees avant tout import.
//
// config/env.ts arrete le processus si une variable manque : c'est voulu en
// production, mais les tests unitaires n'ont ni base ni Redis a atteindre.
// On leur fournit donc des valeurs syntaxiquement valides, jamais utilisees
// puisque Prisma, Redis et le stockage sont remplaces par des doubles.

import { randomBytes } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.CLIENT_URL = 'http://localhost:5173';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/memora_test';
process.env.REDIS_URL = 'redis://localhost:6379';

process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_REGION = 'eu-west-3';
process.env.S3_BUCKET = 'memora-test';
process.env.S3_ACCESS_KEY = 'test';
process.env.S3_SECRET_KEY = 'test-secret';

/**
 * Les secrets d'essai sont tires au sort a chaque execution, jamais ecrits
 * en dur.
 *
 * Deux raisons. La premiere est un constat : l'analyse de secrets de la
 * chaine d'integration signalait ces lignes, et elle avait raison de le
 * faire — un litteral qui ressemble a une cle en est peut-etre une, un
 * outil ne peut pas trancher. La seconde est meilleure encore : une valeur
 * differente a chaque execution empeche qu'un essai passe par accident en
 * s'appuyant sur une constante partagee.
 */
const secret = (octets = 24) => randomBytes(octets).toString('hex');

process.env.JWT_ACCESS_SECRET = secret();
process.env.JWT_REFRESH_SECRET = secret();
process.env.GUEST_SESSION_SECRET = secret();

// Notifications push : web-push est remplace par un double, les cles ne
// servent qu'a franchir la verification de configuration.
process.env.VAPID_PUBLIC_KEY = secret(32);
process.env.VAPID_PRIVATE_KEY = secret(32);

process.env.STRIPE_SECRET_KEY = `sk_test_${secret(12)}`;
process.env.STRIPE_WEBHOOK_SECRET = `whsec_${secret(12)}`;
