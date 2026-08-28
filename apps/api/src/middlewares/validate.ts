// apps/api/src/middlewares/validate.ts
// Applique un schema Zod au corps de la requete avant d'entrer dans le controleur.
//
// L'interet : le controleur recoit des donnees deja validees ET deja typees.
// Il n'a plus a verifier quoi que ce soit, et TypeScript connait la forme exacte
// de req.body grace au generique.

import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    // parse() leve une ZodError, que l'intercepteur central traduit en 422.
    req.body = schema.parse(req.body);
    next();
  };
}
