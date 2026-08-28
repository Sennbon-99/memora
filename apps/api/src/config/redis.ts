// apps/api/src/config/redis.ts
// Connexion Redis et script atomique de decrement du quota.
//
// Pourquoi Redis plutot que PostgreSQL pour compter les poses : lors d'un
// moment fort, plusieurs dizaines de declenchements arrivent en quelques
// secondes sur le meme evenement. Un UPDATE concurrent sur une seule ligne
// de la base serait un point de contention ; un compteur en memoire, non.

import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

redis.on('error', (err) => console.error(' Erreur Redis :', err.message));

/**
 * Script Lua execute par Redis. Son interet tient en un mot : atomicite.
 * Redis execute un script d'un seul tenant, sans qu'aucune autre commande
 * ne s'intercale. Une sequence GET puis DECR, elle, laisserait deux requetes
 * lire la meme valeur avant qu'aucune n'ait ecrit — et le quota deviendrait negatif.
 *
 * Renvoie le nombre de poses restantes, ou -1 si le quota est epuise.
 */
const DECREMENT_IF_POSITIVE = `
  local left = tonumber(redis.call('GET', KEYS[1]) or '0')
  if left <= 0 then return -1 end
  return redis.call('DECR', KEYS[1])
`;

/** Cle du compteur de poses d'une pellicule. */
export const quotaKey = (rollId: string) => `quota:${rollId}`;

/**
 * Reserve une pose si le quota le permet.
 * @returns le nombre de poses restantes, ou -1 si la pellicule est terminee.
 */
export async function decrementQuota(rollId: string): Promise<number> {
  const result = await redis.eval(DECREMENT_IF_POSITIVE, 1, quotaKey(rollId));
  return Number(result);
}

/** Initialise le compteur d'une pellicule, a l'ouverture de la session. */
export async function initQuota(rollId: string, shots: number): Promise<void> {
  await redis.set(quotaKey(rollId), shots);
}
