// apps/api/src/features/team/team.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as teamController from './team.controller.js';

/** Monte sous /api/events/:id — gestion de l'equipe par l'hote. */
export const teamRouter: Router = Router({ mergeParams: true });
teamRouter.use(requireAuth);

// POST /api/events/:id/co-hosts — inviter un co-hote
teamRouter.post('/co-hosts', teamController.invite);

// GET /api/events/:id/co-hosts — lister les co-hotes
teamRouter.get('/co-hosts', teamController.list);

// DELETE /api/events/:id/co-hosts/:userId — retirer un co-hote
teamRouter.delete('/co-hosts/:userId', teamController.remove);

// POST /api/events/:id/photographer — produire le lien du photographe
teamRouter.post('/photographer', teamController.photographerLink);

/** Monte sous /api/p — acces du photographe par son lien, sans compte. */
export const photographerRouter: Router = Router();

// GET /api/p/:token — ouvrir la pellicule du photographe
photographerRouter.get('/:token', teamController.joinAsPhotographer);
