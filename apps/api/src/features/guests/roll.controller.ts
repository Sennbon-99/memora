// apps/api/src/features/guests/roll.controller.ts
// Cote hote : consulter les pellicules et enregistrer leur tri.

import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as rollService from './roll.service.js';
import { currentUserId, routeParam } from '../../utils/http.js';
import { NotFoundError } from '../../utils/errors.js';

/** GET /api/events/:id/rolls — les pellicules, pour l'onglet Invites. */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const rolls = await rollService.listRolls(routeParam(req, 'id'), currentUserId(req));
    res.status(200).json({ rolls });
  } catch (err) {
    next(err);
  }
};

const reviewSchema = z.object({
  // Les identifiants des photographies a masquer. Toutes les autres sont
  // conservees : le non-choix vaut conservation.
  hiddenPhotoIds: z.array(z.string().cuid()).max(200),
});

/** POST /api/events/:id/rolls/:rollId/review — cloture le tri d'une pellicule. */
export const review: RequestHandler = async (req, res, next) => {
  try {
    const { hiddenPhotoIds } = reviewSchema.parse(req.body);
    const result = await rollService.reviewRoll(
      routeParam(req, 'id'),
      routeParam(req, 'rollId'),
      currentUserId(req),
      hiddenPhotoIds,
    );
    if (!result) throw new NotFoundError('Pellicule');

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
