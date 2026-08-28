// apps/api/src/features/dashboard/dashboard.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as dashboardController from './dashboard.controller.js';

export const dashboardRouter: Router = Router({ mergeParams: true });
dashboardRouter.use(requireAuth);

// GET /api/events/:id/stats — statistiques de participation
dashboardRouter.get('/stats', dashboardController.stats);
