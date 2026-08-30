// apps/api/src/utils/jwt.ts
// Emission et verification des jetons.
//
// Deux jetons de durees differentes : un jeton d'acces court, transmis dans
// l'en-tete Authorization, et un jeton de renouvellement long, garde dans un
// cookie inaccessible au JavaScript de la page. Cette separation est ce qui
// rend une attaque CSRF inoperante : le navigateur n'ajoute jamais de lui-meme
// un en-tete Authorization.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';

export interface AccessPayload {
  userId: string;
  role: 'HOST' | 'ADMIN';
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  } catch {
    // On ne remonte jamais la cause exacte : expire ou falsifie, meme reponse.
    throw new UnauthorizedError('Jeton invalide ou expiré');
  }
}

export function verifyRefreshToken(token: string): { userId: string } {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    throw new UnauthorizedError('Session expirée, reconnexion nécessaire');
  }
}

/**
 * Signature du jeton d'appareil de l'invite. Ce n'est pas un JWT : juste un
 * identifiant signe, sans expiration, qui prouve que le cookie vient bien
 * de nous et n'a pas ete fabrique.
 */
export function signDeviceToken(rollId: string): string {
  return jwt.sign({ rollId }, env.GUEST_SESSION_SECRET);
}

export function verifyDeviceToken(token: string): { rollId: string } | null {
  try {
    return jwt.verify(token, env.GUEST_SESSION_SECRET) as { rollId: string };
  } catch {
    // Un cookie invalide n'est pas une erreur : on ouvre simplement une
    // nouvelle pellicule, comme pour un appareil qui arrive pour la premiere fois.
    return null;
  }
}
