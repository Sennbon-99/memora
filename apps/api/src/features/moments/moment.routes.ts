// apps/api/src/features/moments/moment.routes.ts
// Monte sous /api/events/:id/moments — toutes ces routes sont reservees
// a l'hote et a ses co-hotes.

import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as momentController from './moment.controller.js';

export const momentRouter: Router = Router({ mergeParams: true });
momentRouter.use(requireAuth);

// POST /api/events/:id/moments — programmer un moment
momentRouter.post('/', momentController.create);

// GET /api/events/:id/moments — consulter le programme
momentRouter.get('/', momentController.list);

// POST /api/events/:id/moments/:momentId/trigger — ouvrir la fenetre de capture
momentRouter.post('/:momentId/trigger', momentController.trigger);

// POST /api/events/:id/moments/:momentId/close — clore avant terme
momentRouter.post('/:momentId/close', momentController.close);
