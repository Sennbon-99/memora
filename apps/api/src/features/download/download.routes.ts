// apps/api/src/features/download/download.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as downloadController from './download.controller.js';

export const downloadRouter: Router = Router({ mergeParams: true });
downloadRouter.use(requireAuth);

// GET /api/events/:id/archive — telecharger l'album en archive
downloadRouter.get('/archive', downloadController.archive);
