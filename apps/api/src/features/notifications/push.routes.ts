// apps/api/src/features/notifications/push.routes.ts

import { Router } from 'express';
import { requireGuest } from '../../middlewares/requireGuest.js';
import * as pushController from './push.controller.js';

export const pushRouter: Router = Router();

// GET /api/push/key — la cle publique, avant toute pellicule.
// Elle est publique et ne depend d'aucun invite : elle est donc montee
// avant requireGuest.
pushRouter.get('/key', pushController.publicKey);

// Tout le reste suppose une pellicule ouverte sur cet appareil.
pushRouter.use(requireGuest);

// POST /api/push/subscribe — s'abonner aux notifications de son evenement
pushRouter.post('/subscribe', pushController.subscribe);
