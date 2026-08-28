// apps/api/src/features/guests/guest.controller.ts
// Traduit HTTP pour le parcours invite, et pose le cookie d'appareil.

import type { RequestHandler } from 'express';
import { z } from 'zod';
import { joinEventSchema, recoveryCodeSchema } from '@memora/types';
import * as guestService from './guest.service.js';
import { currentRoll, routeParam } from '../../utils/http.js';
import { DEVICE_COOKIE } from '../../middlewares/requireGuest.js';
import { isProduction } from '../../config/env.js';
import { UnauthorizedError } from '../../utils/errors.js';

/**
 * Le cookie d'appareil n'expire pas : il porte le quota, et une pellicule
 * reste valable tant que l'evenement existe. SameSite lax et non strict,
 * car l'invite arrive depuis un scanner de QR code, donc d'un autre contexte.
 */
const deviceCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 90 * 24 * 60 * 60 * 1000,
};

/** GET /api/e/:slug — arrivee sur l'evenement apres le scan. */
export const join: RequestHandler = async (req, res, next) => {
  try {
    const existing = req.cookies?.[DEVICE_COOKIE] as string | undefined;
    const session = await guestService.joinEvent(routeParam(req, 'slug'), existing);

    res.cookie(DEVICE_COOKIE, session.deviceToken, deviceCookieOptions);
    // Le jeton n'est pas renvoye dans le corps : il ne doit pas etre
    // accessible au JavaScript de la page.
    const { deviceToken: _omit, ...payload } = session;
    res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
};

/** POST /api/e/:slug/consent — acceptation du droit a l'image. */
export const consent: RequestHandler = async (req, res, next) => {
  try {
    res.status(200).json(await guestService.giveConsent(currentRoll(req).id));
  } catch (err) {
    next(err);
  }
};

/** POST /api/e/:slug/identity — prenom et table, tous deux facultatifs. */
export const identity: RequestHandler = async (req, res, next) => {
  try {
    const input = joinEventSchema.parse(req.body);
    res.status(200).json(await guestService.setIdentity(currentRoll(req).id, input));
  } catch (err) {
    next(err);
  }
};

const codeSchema = z.object({ code: z.string().regex(/^\d{4}$/) });

/** POST /api/e/:slug/recovery-code — enregistrer son code de recuperation. */
export const saveCode: RequestHandler = async (req, res, next) => {
  try {
    const { code } = codeSchema.parse(req.body);
    res.status(200).json(await guestService.saveRecoveryCode(currentRoll(req).id, code));
  } catch (err) {
    next(err);
  }
};

/** POST /api/e/:slug/recover — retrouver sa pellicule depuis un autre appareil. */
export const recover: RequestHandler = async (req, res, next) => {
  try {
    const input = recoveryCodeSchema.parse(req.body);
    const { deviceToken, rollId } = await guestService.recoverRoll(routeParam(req, 'slug'), input);

    res.cookie(DEVICE_COOKIE, deviceToken, deviceCookieOptions);
    res.status(200).json({ rollId });
  } catch (err) {
    next(err);
  }
};
