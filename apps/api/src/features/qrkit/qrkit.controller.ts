// apps/api/src/features/qrkit/qrkit.controller.ts

import type { RequestHandler } from 'express';
import * as qrkitService from './qrkit.service.js';
import { parsePieces } from './qrkit.cards.js';
import { currentUserId, routeParam } from '../../utils/http.js';

/**
 * GET /api/events/:id/qr-kit?pieces=affiche-a3,cartes
 *
 * Une seule piece demandee donne un PDF, plusieurs donnent une archive : on
 * n'imprime pas une affiche A3 et huit cartes A5 sur la meme machine, et un
 * PDF aux pages de tailles differentes est refuse par une partie des services
 * d'impression.
 */
export const download: RequestHandler = async (req, res, next) => {
  const demandees = parsePieces(
    typeof req.query['pieces'] === 'string' ? req.query['pieces'] : undefined,
  );

  try {
    if (demandees.length === 1) {
      const { nom, pdf } = await qrkitService.generatePiece(
        routeParam(req, 'id'), currentUserId(req), demandees[0]!,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nom}"`);
      res.status(200).send(pdf);
      return;
    }

    // Diffusee au fil de l'eau, comme l'archive de l'album : les en-tetes
    // partent avant que la derniere piece soit rendue.
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="memora-kit.zip"');
    await qrkitService.streamKit(
      routeParam(req, 'id'), currentUserId(req), demandees, res,
    );
  } catch (err) {
    // Apres le debut de la diffusion les en-tetes sont deja partis : on ne
    // peut plus renvoyer un statut, seulement couper.
    if (res.headersSent) {
      res.destroy();
      return;
    }
    next(err);
  }
};
