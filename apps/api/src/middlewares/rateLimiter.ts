// apps/api/src/middlewares/rateLimiter.ts
// Limitation du debit, pour freiner les tentatives repetees.

import rateLimit from 'express-rate-limit';

/** Limite generale, appliquee a toute l'API. */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

/**
 * Limite serree sur l'authentification et la saisie du code de recuperation.
 * Le message est volontairement identique quelle que soit la cause : on ne
 * revele jamais si l'adresse existe ou si c'est le mot de passe qui est faux.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  message: { code: 'TOO_MANY_ATTEMPTS', message: 'Trop de tentatives, réessayez plus tard' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
