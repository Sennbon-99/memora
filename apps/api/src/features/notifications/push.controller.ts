// apps/api/src/features/notifications/push.controller.ts

import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as pushService from './push.service.js';
import { currentRoll } from '../../utils/http.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

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
