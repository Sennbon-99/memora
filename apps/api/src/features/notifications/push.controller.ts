// apps/api/src/features/notifications/push.controller.ts

import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as pushService from './push.service.js';
import { currentRoll } from '../../utils/http.js';
import { env } from '../../config/env.js';
import { apnsConfigured } from './apns.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

// Apple remet un jeton binaire rendu en hexadecimal. On verifie sa forme
// plutot que sa seule presence : un jeton mal transmis serait sinon
// enregistre puis rejete a chaque envoi, sans que rien ne le signale.
const deviceSchema = z.object({
  deviceToken: z.string().regex(/^[0-9a-fA-F]{64,200}$/, "Jeton d'appareil invalide"),
});

/**
 * GET /api/push/key — la cle publique VAPID.
 *
 * Le navigateur en a besoin pour construire l'abonnement. Elle est publique
 * par nature : c'est la cle privee, qui reste sur le serveur, qui signe les
 * envois. Sans cette route, le client ne peut tout simplement pas s'abonner.
 */
export const publicKey: RequestHandler = (_req, res) => {
  const key = env.VAPID_PUBLIC_KEY;
  // Les notifications sont facultatives : l'API tourne sans. On le dit au
  // client plutot que d'echouer, pour qu'il masque la proposition.
  res.status(200).json({ key: key ?? null, available: Boolean(key), native: apnsConfigured() });
};

/** POST /api/push/subscribe — enregistrer l'abonnement de cet appareil. */
export const subscribe: RequestHandler = async (req, res, next) => {
  try {
    const subscription = subscriptionSchema.parse(req.body);
    const result = await pushService.subscribe(currentRoll(req).id, subscription);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/push/device — enregistrer le jeton d'un appareil iOS.
 *
 * L'application installee ne peut pas passer par le Web Push : dans une
 * WKWebView, le service worker ne recoit rien. Elle remet donc le jeton que
 * lui a donne le systeme, et le serveur passe par le service d'Apple.
 */
export const registerDevice: RequestHandler = async (req, res, next) => {
  try {
    const { deviceToken } = deviceSchema.parse(req.body);
    const result = await pushService.subscribeDevice(currentRoll(req).id, deviceToken);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};
