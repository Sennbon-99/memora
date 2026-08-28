// apps/api/src/utils/http.ts
// Petits accesseurs partages par les controleurs.
//
// Ils existent pour une raison de typage : Express 5 type req.params comme
// pouvant contenir des tableaux, et req.user comme optionnel. Les middlewares
// requireAuth et requireGuest garantissent pourtant leur presence, mais
// TypeScript ne peut pas le savoir. Plutot que de semer des points
// d'exclamation dans chaque controleur, on centralise la verification ici.

import type { Request } from 'express';
import type { AuthUser } from '../middlewares/requireAuth.js';
import type { GuestRoll } from '../middlewares/requireGuest.js';
import { NotFoundError, UnauthorizedError } from './errors.js';

/** Parametre de route, garanti sous forme de chaine. */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new NotFoundError('Ressource');
  }
  return value;
}

/** Utilisateur authentifie, place par requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

/** Identifiant de l'utilisateur authentifie. */
export function currentUserId(req: Request): string {
  return currentUser(req).id;
}

/** Pellicule de l'invite, placee par requireGuest. */
export function currentRoll(req: Request): GuestRoll {
  if (!req.roll) throw new UnauthorizedError();
  return req.roll;
}
