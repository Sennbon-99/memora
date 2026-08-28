// apps/api/src/middlewares/requireGuest.ts
// Charge la pellicule de l'invite a partir du cookie d'appareil.
//
// Difference importante avec requireAuth : ici il n'y a pas d'identite,
// seulement un appareil. Le cookie ne prouve pas qui est la personne,
// il prouve que cet appareil a bien ouvert cette pellicule.

import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma.js';
import { verifyDeviceToken } from '../utils/jwt.js';
import { UnauthorizedError, ConsentRequiredError } from '../utils/errors.js';

export const DEVICE_COOKIE = 'memora_device';

export interface GuestRoll {
  id: string;
  eventId: string;
  consentedAt: Date | null;
  shotsLeft: number;
  bonusShots: number;
  tableId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      roll?: GuestRoll;
    }
  }
}

export const requireGuest: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[DEVICE_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedError('Aucune pellicule ouverte sur cet appareil');

    const decoded = verifyDeviceToken(token);
    if (!decoded) throw new UnauthorizedError('Session invalide');

    const roll = await prisma.roll.findUnique({
      where: { id: decoded.rollId },
      select: { id: true, eventId: true, consentedAt: true, shotsLeft: true, bonusShots: true, tableId: true },
    });
    if (!roll) throw new UnauthorizedError('Pellicule introuvable');

    req.roll = roll;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Exige que le consentement ait ete donne.
 * Se chaine apres requireGuest, sur toute route qui touche a une photographie.
 * C'est la mise en oeuvre de la regle RG-04 : le consentement est anterieur
 * a toute prise de vue, et cette verification est cote serveur.
 */
export const requireConsent: RequestHandler = (req, _res, next) => {
  if (!req.roll) return next(new UnauthorizedError());
  if (!req.roll.consentedAt) return next(new ConsentRequiredError());
  next();
};
