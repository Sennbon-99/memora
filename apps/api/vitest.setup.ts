// apps/api/vitest.setup.ts
// Variables d'environnement des tests, posees avant tout import.
//
// config/env.ts arrete le processus si une variable manque : c'est voulu en
// production, mais les tests unitaires n'ont ni base ni Redis a atteindre.
// On leur fournit donc des valeurs syntaxiquement valides, jamais utilisees
// puisque Prisma, Redis et le stockage sont remplaces par des doubles.

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

// Trente-deux caracteres minimum, comme l'exige le schema de validation.
process.env.JWT_ACCESS_SECRET = 'secret-de-test-access-32-caracteres-min';
process.env.JWT_REFRESH_SECRET = 'secret-de-test-refresh-32-caracteres-min';
process.env.GUEST_SESSION_SECRET = 'secret-de-test-guest-32-caracteres-min';

process.env.STRIPE_SECRET_KEY = 'sk_test_faux';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_faux';
