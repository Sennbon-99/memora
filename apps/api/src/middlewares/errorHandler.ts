// apps/api/src/middlewares/errorHandler.ts
// Intercepteur central, place en dernier dans la chaine Express.
// Toute exception qui remonte passe ici : elle est journalisee avec un
// identifiant de correlation, puis traduite en reponse normalisee.
// Cet identifiant est aussi renvoye au client, ce qui permet de relier
// un signalement d'utilisateur a une ligne precise du journal.

import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { isProduction } from '../config/env.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const traceId = randomUUID();

  // 1. Erreur de validation : on renvoie le detail des champs fautifs,
  // c'est une information utile au client et sans risque.
  if (err instanceof ZodError) {
    res.status(422).json({
      code: 'VALIDATION_ERROR',
      message: 'Données invalides',
      fields: err.flatten().fieldErrors,
      traceId,
    });
    return;
  }

  // 2. Erreur applicative prevue : son message est ecrit pour l'utilisateur.
  if (err instanceof AppError) {
    console.warn(`  [${traceId}] ${err.code} sur ${req.method} ${req.path} — ${err.message}`);
    res.status(err.httpStatus).json({ code: err.code, message: err.message, traceId });
    return;
  }

  // 3. Tout le reste est une erreur interne : le detail reste au serveur.
  console.error(` [${traceId}] Erreur non geree sur ${req.method} ${req.path}`, err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Une erreur interne est survenue',
    traceId,
    ...(isProduction ? {} : { debug: String(err) }),
  });
};
