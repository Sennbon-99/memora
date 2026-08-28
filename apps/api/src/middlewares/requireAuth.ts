// apps/api/src/middlewares/requireAuth.ts
// Authentification de l'hote.
//
// Verifie le jeton d'acces, puis RECHARGE l'utilisateur depuis la base plutot
// que de faire confiance au contenu du jeton. Un compte supprime ou dont le
// role a change ne doit pas continuer a passer parce qu'il detient un jeton
// emis quinze minutes plus tot.

import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import type { UserRole } from '../../generated/prisma/index.js';

/** Utilisateur authentifie, attache a la requete pour la suite de la chaine. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// Express ne connait pas req.user : on etend son type une fois pour toutes.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Jeton manquant');

    const token = header.slice('Bearer '.length);
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new UnauthorizedError('Utilisateur introuvable');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Restreint une route a certains roles. S'utilise apres requireAuth :
 *   router.delete('/:id', requireAuth, requireRole('ADMIN'), supprimerEvenement)
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
}
