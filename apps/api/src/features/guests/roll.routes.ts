// apps/api/src/features/guests/roll.routes.ts
// Routes de l'hote sur les pellicules. mergeParams pour recuperer :id,
// monte par le routeur principal sous /events/:id.

import { Router } from 'express';
import * as rollController from './roll.controller.js';

export const rollRouter: Router = Router({ mergeParams: true });

// GET /api/events/:id/rolls — lister les pellicules a trier
rollRouter.get('/rolls', rollController.list);

// GET /api/events/:id/rolls/:rollId/photos — les photographies d'une pellicule
rollRouter.get('/rolls/:rollId/photos', rollController.photos);

// POST /api/events/:id/rolls/:rollId/review — cloturer le tri d'une pellicule
rollRouter.post('/rolls/:rollId/review', rollController.review);
