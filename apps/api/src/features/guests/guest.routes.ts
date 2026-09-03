// apps/api/src/features/guests/guest.routes.ts
// Routes publiques : aucune n'exige de compte. C'est tout l'interet du produit.

import { Router } from 'express';
import { requireGuest } from '../../middlewares/requireGuest.js';
import { authLimiter } from '../../middlewares/rateLimiter.js';
import * as guestController from './guest.controller.js';

export const guestRouter: Router = Router();

// GET /api/e/:slug — rejoindre l'evenement, ou restaurer sa pellicule
guestRouter.get('/:slug', guestController.join);

// Le lien personnel remplace le code a quatre chiffres : il fonctionne aussi
// pour un invite reste anonyme et sur un autre appareil.
guestRouter.get('/:slug/recovery-link', requireGuest, guestController.recoveryLink);
guestRouter.post('/:slug/recovery-link', authLimiter, guestController.openRecoveryLink);

// POST /api/e/:slug/consent — accepter le droit a l'image
guestRouter.post('/:slug/consent', requireGuest, guestController.consent);

// POST /api/e/:slug/identity — renseigner prenom et table
guestRouter.post('/:slug/identity', requireGuest, guestController.identity);

// POST /api/e/:slug/recovery-code — enregistrer son code a quatre chiffres
guestRouter.post('/:slug/recovery-code', requireGuest, guestController.saveCode);

// POST /api/e/:slug/recover — retrouver sa pellicule depuis un autre appareil
// Debit limite : le code ne fait que quatre chiffres.
guestRouter.post('/:slug/recover', authLimiter, guestController.recover);
