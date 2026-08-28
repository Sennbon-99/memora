// apps/api/src/features/payments/payment.controller.ts

import type { RequestHandler } from 'express';
import * as paymentService from './payment.service.js';
import { currentUserId, routeParam } from '../../utils/http.js';
import { AppError, UnauthorizedError } from '../../utils/errors.js';

/** POST /api/events/:id/checkout — obtenir l'adresse de paiement. */
export const checkout: RequestHandler = async (req, res, next) => {
  try {
    const result = await paymentService.createCheckoutSession(routeParam(req, 'id'), currentUserId(req));
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/** GET /api/events/:id/payment — verification differee de l'etat du paiement. */
export const status: RequestHandler = async (req, res, next) => {
  try {
    res.status(200).json(await paymentService.syncPayment(routeParam(req, 'id'), currentUserId(req)));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/stripe/webhook — notification du prestataire.
 *
 * req.body est ici un Buffer, et non un objet : cette route est montee avec
 * express.raw() AVANT express.json(), sans quoi la signature ne pourrait
 * plus etre verifiee.
 */
export const webhook: RequestHandler = async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      throw new AppError('MISSING_SIGNATURE', 400, 'Signature absente');
    }

    const result = await paymentService.handleWebhook(req.body as Buffer, signature);
    // On acquitte rapidement : le prestataire reessaie si l'on tarde.
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
