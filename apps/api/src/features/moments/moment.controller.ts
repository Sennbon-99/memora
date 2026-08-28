// apps/api/src/features/moments/moment.controller.ts

import type { RequestHandler } from 'express';
import { createMomentSchema } from '@memora/types';
import * as momentService from './moment.service.js';
import { notifyEvent } from '../notifications/push.service.js';
import { currentUserId, routeParam } from '../../utils/http.js';
import { UnauthorizedError } from '../../utils/errors.js';

/** POST /api/events/:id/moments — programmer un moment. */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const input = createMomentSchema.parse(req.body);
    const moment = await momentService.createMoment(routeParam(req, 'id'), currentUserId(req), input);
    res.status(201).json({ moment });
  } catch (err) {
    next(err);
  }
};

/** GET /api/events/:id/moments — le programme de la soiree. */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const moments = await momentService.listMoments(routeParam(req, 'id'), currentUserId(req));
    res.status(200).json({ moments });
  } catch (err) {
    next(err);
  }
};

/** POST /api/events/:id/moments/:momentId/trigger — ouvrir la fenetre. */
export const trigger: RequestHandler = async (req, res, next) => {
  try {
    const moment = await momentService.triggerMoment(routeParam(req, 'momentId'), currentUserId(req));

    // Les invites connectes sont prevenus immediatement. Ceux qui n'ont pas
    // l'application ouverte verront le bandeau a leur retour, tant que la
    // fenetre n'est pas expiree.
    req.io.to(`event:${routeParam(req, 'id')}`).emit('moment:started', {
      momentId: moment.id,
      label: moment.label,
      endsAt: moment.endsAt,
      bonusShots: moment.bonusShots,
    });

    // Notification push pour ceux qui l'ont acceptee. Les autres verront
    // le bandeau a la reouverture, tant que la fenetre n'est pas expiree.
    void notifyEvent(routeParam(req, 'id'), {
      title: moment.label,
      body: `Vous avez ${moment.bonusShots} poses en plus pendant 10 minutes`,
      url: `/e/${routeParam(req, 'id')}`,
    });

    res.status(200).json({ moment });
  } catch (err) {
    next(err);
  }
};

/** POST /api/events/:id/moments/:momentId/close — clore avant terme. */
export const close: RequestHandler = async (req, res, next) => {
  try {
    const result = await momentService.closeMoment(routeParam(req, 'momentId'), currentUserId(req));
    req.io.to(`event:${routeParam(req, 'id')}`).emit('moment:ended', { momentId: result.id });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
