// apps/api/src/features/qrkit/qrkit.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as qrkitController from './qrkit.controller.js';

export const qrkitRouter: Router = Router({ mergeParams: true });
qrkitRouter.use(requireAuth);

// GET /api/events/:id/qr-kit — telecharger le kit de QR codes en PDF
qrkitRouter.get('/qr-kit', qrkitController.download);
