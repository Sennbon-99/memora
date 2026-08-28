// apps/api/src/features/payments/payment.routes.ts

import express, { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as paymentController from './payment.controller.js';

/** Monte sous /api/events/:id — actions de l'hote. */
export const paymentRouter: Router = Router({ mergeParams: true });
paymentRouter.use(requireAuth);

// POST /api/events/:id/checkout — creer la session de paiement
paymentRouter.post('/checkout', paymentController.checkout);

// GET /api/events/:id/payment — verifier l'etat du paiement
paymentRouter.get('/payment', paymentController.status);

/**
 * Routeur du webhook, monte separement et AVANT express.json().
 * express.raw() conserve le corps brut, indispensable a la verification
 * de signature : un corps deja transforme en objet ne peut plus etre verifie.
 */
export const stripeWebhookRouter: Router = Router();
stripeWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.webhook,
);
