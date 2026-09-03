// apps/api/src/features/photos/photo.controller.ts
// Traduit HTTP pour la prise de vue.

import type { RequestHandler } from 'express';
import { confirmPhotoSchema, removalRequestSchema, reservePhotoSchema } from '@memora/types';
import * as photoService from './photo.service.js';
import { currentRoll } from '../../utils/http.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { emitToEvent } from '../../realtime/broadcast.js';
import { streamGuestAlbumArchive } from '../download/download.service.js';

/** POST /api/photos/reserve — reserver une pose et obtenir l'adresse d'envoi. */
export const reserve: RequestHandler = async (req, res, next) => {
  try {
    const input = reservePhotoSchema.parse(req.body);
    const reservation = await photoService.reserveShot(currentRoll(req), input);
    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
};

/** POST /api/photos/confirm — confirmer que le transfert a abouti. */
export const confirm: RequestHandler = async (req, res, next) => {
  try {
    const { idempotencyKey } = confirmPhotoSchema.parse(req.body);
    const result = await photoService.confirmUpload(currentRoll(req), idempotencyKey);

    // Le tableau de bord de l'hote se met a jour sans rechargement.
    emitToEvent(req, currentRoll(req).eventId, 'photo:uploaded', { photoId: result.photoId });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/** GET /api/photos/mine — l'album visible par cet invite. */
export const mine: RequestHandler = async (req, res, next) => {
  try {
    res.status(200).json(await photoService.listOwnPhotos(currentRoll(req)));
  } catch (err) {
    next(err);
  }
};

/** GET /api/photos/archive — toutes les photos visibles, dans une archive. */
export const archive: RequestHandler = async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="memora-album.zip"');
    await streamGuestAlbumArchive(currentRoll(req), res);
  } catch (err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    next(err);
  }
};

/** POST /api/photos/removal — demander le retrait d'une photographie. */
export const removal: RequestHandler = async (req, res, next) => {
  try {
    const { photoId, reason } = removalRequestSchema.parse(req.body);
    const request = await photoService.requestRemoval(currentRoll(req), photoId, reason);
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
};
