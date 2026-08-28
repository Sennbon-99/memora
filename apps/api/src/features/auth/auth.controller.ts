// apps/api/src/features/auth/auth.controller.ts
// Le controleur fait le lien entre HTTP et le service : il lit la requete,
// appelle le service, pose le cookie et choisit le code de statut.
// Aucune regle metier ici. Les erreurs partent vers l'intercepteur via next().

import type { RequestHandler } from 'express';
import * as authService from './auth.service.js';
import { verifyRefreshToken } from '../../utils/jwt.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { isProduction } from '../../config/env.js';

const REFRESH_COOKIE = 'memora_refresh';

/** Options du cookie de renouvellement, regroupees pour ne pas les oublier. */
const refreshCookieOptions = {
  httpOnly: true,          // inaccessible au JavaScript de la page
  secure: isProduction,    // uniquement en HTTPS une fois en production
  sameSite: 'strict' as const, // le navigateur ne l'envoie jamais depuis un autre site
  path: '/api/auth/refresh',   // et seulement sur cette route
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    res.status(200).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedError('Session absente');

    const { userId } = verifyRefreshToken(token);
    res.status(200).json(await authService.refresh(userId));
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.status(204).end();
};

/** Renvoie l'utilisateur courant, deja charge par requireAuth. */
export const me: RequestHandler = (req, res) => {
  res.status(200).json({ user: req.user });
};
