// apps/api/src/features/publication/publication.controller.ts
// Traduit HTTP pour le tri, la publication et la consultation d'album.

import type { RequestHandler } from 'express';
import { z } from 'zod';
import { PUBLICATION_SCOPES, publishEventSchema } from '@memora/types';
import * as publicationService from './publication.service.js';
import { notifyEvent } from '../notifications/push.service.js';
import { currentUserId, routeParam } from '../../utils/http.js';
import type { Viewer } from './visibility.js';
import { verifyDeviceToken } from '../../utils/jwt.js';
import { DEVICE_COOKIE } from '../../middlewares/requireGuest.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { emitToEvent } from '../../realtime/broadcast.js';

/** GET /api/events/:id/album — l'album complet, reserve a l'hote. */
export const albumForHost: RequestHandler = async (req, res, next) => {
  try {
    const photos = await publicationService.getAlbumForHost(routeParam(req, 'id'), currentUserId(req));
    res.status(200).json({ photos });
  } catch (err) {
    next(err);
  }
};

/** GET /api/events/:id/removals — les demandes de retrait de la soiree. */
export const listRemovals: RequestHandler = async (req, res, next) => {
  try {
    const removals = await publicationService.listRemovals(
      routeParam(req, 'id'),
      currentUserId(req),
    );
    res.status(200).json({ removals });
  } catch (err) {
    next(err);
  }
};

const publishReviewedSchema = z.object({
  // Obligatoire a la premiere publication seulement : ensuite la portee est
  // fixee pour la soiree.
  scope: z.enum(PUBLICATION_SCOPES).optional(),
});

/**
 * POST /api/events/:id/publish-reviewed — publier ce qui est trie.
 *
 * Publication au fil de l'eau : chaque pellicule triee rejoint l'album sans
 * attendre les autres.
 */
export const publishReviewed: RequestHandler = async (req, res, next) => {
  try {
    const { scope } = publishReviewedSchema.parse(req.body);
    const eventId = routeParam(req, 'id');
    const result = await publicationService.publishReviewed(eventId, currentUserId(req), scope);

    emitToEvent(req, eventId, 'album:published', {
      publishedNow: result.publishedNow,
      scope: result.scope,
    });

    // Deux notifications au total, et pas une par publication : une
    // application qui previent douze fois finit coupee. La premiere dit que
    // l'album existe, la seconde qu'il est complet. Les publications
    // intermediaires enrichissent l'album en silence.
    const visibleToGuests = result.scope === 'EVERYONE' || result.scope === 'OWN_ONLY';
    if (result.first && visibleToGuests) {
      void notifyEvent(eventId, {
        title: "L'album est en ligne",
        body: 'Vos photographies sont disponibles',
        url: `/e/${result.slug}`,
      });
    } else if (result.complete && visibleToGuests) {
      void notifyEvent(eventId, {
        title: "L'album est complet",
        body: 'Toutes les photographies de la soirée ont été publiées',
        url: `/e/${result.slug}`,
      });
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/** POST /api/events/:id/publish — publier la selection selon une portee. */
export const publish: RequestHandler = async (req, res, next) => {
  try {
    const input = publishEventSchema.parse(req.body);
    const result = await publicationService.publishAlbum(routeParam(req, 'id'), currentUserId(req), input);

    // Les invites connectes sont prevenus que l'album est en ligne.
    emitToEvent(req, routeParam(req, 'id'), 'album:published', { scope: result.scope });

    // La notification qui fait revenir l'invite : c'est le seul moment ou
    // il decouvre ce qu'il a photographie.
    void notifyEvent(routeParam(req, 'id'), {
      title: "L'album est en ligne",
      body: 'Vos photographies sont disponibles',
      url: `/album/${result.albumToken}`,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const accessSchema = z.object({ accessCode: z.string().regex(/^\d{6}$/).optional() });

/**
 * GET /api/album/:token — consultation par le lien de partage.
 *
 * Route publique : elle determine elle-meme qui regarde. Si l'appareil
 * porte un cookie de pellicule valide, l'observateur est un invite et le
 * moteur de visibilite pourra lui montrer ses propres photographies.
 * Sinon, c'est un simple detenteur du lien.
 */
export const publicAlbum: RequestHandler = async (req, res, next) => {
  try {
    const { accessCode } = accessSchema.parse(req.query);

    const cookie = req.cookies?.[DEVICE_COOKIE] as string | undefined;
    const decoded = cookie ? verifyDeviceToken(cookie) : null;
    const viewer: Viewer = decoded
      ? { kind: 'GUEST', rollId: decoded.rollId }
      : { kind: 'LINK' };

    const album = await publicationService.getPublicAlbum(routeParam(req, 'token'), viewer, accessCode);
    res.status(200).json(album);
  } catch (err) {
    next(err);
  }
};

const decisionSchema = z.object({ accept: z.boolean() });

/** POST /api/removals/:id — arbitrer une demande de retrait. */
export const handleRemoval: RequestHandler = async (req, res, next) => {
  try {
    const { accept } = decisionSchema.parse(req.body);
    const result = await publicationService.handleRemoval(routeParam(req, 'id'), currentUserId(req), accept);
    res.status(200).json({ request: result });
  } catch (err) {
    next(err);
  }
};
