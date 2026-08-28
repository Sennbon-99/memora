// apps/api/src/config/redis.ts
// Connexion Redis et consommation atomique des poses.
//
// Pourquoi Redis plutot que PostgreSQL pour compter les poses : lors d'un
// moment fort, plusieurs dizaines de declenchements arrivent en quelques
// secondes sur le meme evenement. Un UPDATE concurrent sur une seule ligne
// de la base serait un point de contention ; un compteur en memoire, non.

import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

redis.on('error', (err: Error) => console.error('Erreur Redis :', err.message));

/** Compteur du quota principal d'une pellicule. */
export const quotaKey = (rollId: string) => `quota:${rollId}`;
/** Compteur des poses bonus, avec expiration a la fin du moment fort. */
export const bonusKey = (rollId: string) => `bonus:${rollId}`;

/**
 * Consomme une pose, en puisant d'abord dans les poses bonus.
 *
 * L'atomicite est le point central. Redis execute un script d'un seul tenant,
 * sans qu'aucune autre commande ne s'intercale. Une sequence GET puis DECR
 * laisserait deux requetes simultanees lire la meme valeur avant qu'aucune
 * n'ait ecrit, et le compteur passerait sous zero.
 *
 * L'ordre bonus puis quota n'est pas arbitraire : les poses bonus expirent
 * a la fermeture du moment, autant les depenser en premier.
 *
 * Renvoie [restant, source] ou source vaut 1 pour une pose bonus, 0 pour
 * une pose du quota principal, et restant vaut -1 si plus rien n'est disponible.
 */
const CONSUME_SHOT = `
  local bonus = tonumber(redis.call('GET', KEYS[1]) or '0')
  if bonus > 0 then
    return { redis.call('DECR', KEYS[1]), 1 }
  end
  local left = tonumber(redis.call('GET', KEYS[2]) or '0')
  if left <= 0 then return { -1, 0 } end
  return { redis.call('DECR', KEYS[2]), 0 }
`;

export interface ShotConsumption {
  /** Poses restantes dans le compteur qui a ete debite. */
  remaining: number;
  /** Vrai si la pose provenait du credit d'un moment fort. */
  fromBonus: boolean;
}

export async function consumeShot(rollId: string): Promise<ShotConsumption> {
  const [remaining, source] = (await redis.eval(
    CONSUME_SHOT, 2, bonusKey(rollId), quotaKey(rollId),
  )) as [number, number];

  return { remaining: Number(remaining), fromBonus: source === 1 };
}

/** Rend une pose, lorsqu'une reservation echoue apres le decrement. */
export async function refundShot(rollId: string, fromBonus: boolean): Promise<void> {
  await redis.incr(fromBonus ? bonusKey(rollId) : quotaKey(rollId));
}

/** Initialise le compteur d'une pellicule, a l'ouverture de la session. */
export async function initQuota(rollId: string, shots: number): Promise<void> {
  await redis.set(quotaKey(rollId), shots);
}

/**
 * Cree des poses bonus valables le temps d'un moment fort.
 * L'expiration est portee par Redis : inutile de nettoyer quoi que ce soit,
 * les poses non utilisees disparaissent d'elles-memes.
 */
export async function grantBonusShots(
  rollId: string, shots: number, ttlSeconds: number,
): Promise<void> {
  await redis.set(bonusKey(rollId), shots, 'EX', ttlSeconds);
}

/** Lecture du quota restant, sans le modifier. */
export async function readQuota(rollId: string): Promise<number | null> {
  const value = await redis.get(quotaKey(rollId));
  return value === null ? null : Number(value);
}
