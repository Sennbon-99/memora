// apps/api/src/features/notifications/push.routes.ts

import { Router } from 'express';
import { requireGuest } from '../../middlewares/requireGuest.js';
import * as pushController from './push.controller.js';

export const pushRouter: Router = Router();
pushRouter.use(requireGuest);

// POST /api/push/subscribe — s'abonner aux notifications de son evenement
pushRouter.post('/subscribe', pushController.subscribe);
