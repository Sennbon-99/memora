// apps/api/src/features/publication/publication.routes.ts
// Deux groupes de routes : celles de l'hote, protegees, et la consultation
// publique de l'album, qui n'exige aucun compte.

import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as publicationController from './publication.controller.js';

/** Monte sous /api/events/:id — actions de l'hote sur son album. */
export const hostAlbumRouter = Router({ mergeParams: true });
hostAlbumRouter.use(requireAuth);

// GET /api/events/:id/album — consulter l'album complet pour le tri
hostAlbumRouter.get('/album', publicationController.albumForHost);

// POST /api/events/:id/publish — publier la selection
hostAlbumRouter.post('/publish', publicationController.publish);

/** Monte sous /api/album — consultation par lien de partage, sans compte. */
export const publicAlbumRouter = Router();

// GET /api/album/:token — consulter un album publie
publicAlbumRouter.get('/:token', publicationController.publicAlbum);

/** Monte sous /api/removals — arbitrage des demandes de retrait. */
export const removalRouter = Router();
removalRouter.use(requireAuth);

// POST /api/removals/:id — accepter ou refuser un retrait
removalRouter.post('/:id', publicationController.handleRemoval);
