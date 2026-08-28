// apps/api/src/features/download/download.controller.ts

import type { RequestHandler } from 'express';
import * as downloadService from './download.service.js';
import { currentUserId, routeParam } from '../../utils/http.js';

/**
 * GET /api/events/:id/archive — telecharger l'album complet.
 *
 * La reponse est diffusee au fil de l'eau : les en-tetes partent avant que
 * le premier fichier ne soit lu, et le navigateur affiche la progression.
 * Sans cela, l'hote attendrait plusieurs minutes devant une page figee.
 */
export const archive: RequestHandler = async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="memora-album.zip"');

    await downloadService.streamAlbumArchive(
      routeParam(req, 'id'), currentUserId(req), res,
    );
  } catch (err) {
    // Si l'erreur survient apres le debut de la diffusion, les en-tetes sont
    // deja partis : on ne peut plus renvoyer un statut, seulement couper.
    if (res.headersSent) {
      res.destroy();
      return;
    }
    next(err);
  }
};
