// apps/api/src/features/qrkit/qrkit.controller.ts

import type { RequestHandler } from 'express';
import * as qrkitService from './qrkit.service.js';
import { UnauthorizedError } from '../../utils/errors.js';

/** GET /api/events/:id/qr-kit — telecharger le kit imprimable. */
export const download: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const pdf = await qrkitService.generateKit(req.params.id!, req.user.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="memora-qr-kit.pdf"');
    res.status(200).send(pdf);
  } catch (err) {
    next(err);
  }
};
