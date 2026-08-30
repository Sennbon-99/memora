// apps/api/src/config/env.ts
// Validation des variables d'environnement au demarrage.
// Le principe : si une variable manque ou est mal formee, le serveur refuse
// de demarrer avec un message clair, plutot que de tomber trois heures plus tard
// sur une erreur incomprehensible en pleine soiree.

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_URL: z.string().url(),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),

  // Secrets distincts : compromettre l'un ne compromet pas les autres.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GUEST_SESSION_SECRET: z.string().min(32),

  // Notifications push : facultatives, l'API tourne sans.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('contact@memora.app'),

  // Notifications de l'application installee sur iPhone. Facultatives : sans
  // elles l'API demarre et le canal Web Push fonctionne seul.
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_PRIVATE_KEY: z.string().optional(),
  APNS_TOPIC: z.string().optional(),
  APNS_SANDBOX: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(' Variables d\'environnement invalides :');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/** Configuration validee, typee, utilisable partout dans l'application. */
export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
