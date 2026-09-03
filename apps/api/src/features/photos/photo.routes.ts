// apps/api/src/features/photos/photo.routes.ts
import { Router } from 'express';
import { requireGuest, requireConsent } from '../../middlewares/requireGuest.js';
import * as photoController from './photo.controller.js';

export const photoRouter: Router = Router();

// Toutes ces routes supposent une pellicule ouverte sur cet appareil.
photoRouter.use(requireGuest);

// POST /api/photos/reserve — reserver une pose
// requireConsent applique la regle RG-04 : pas de prise de vue sans accord.
photoRouter.post('/reserve', requireConsent, photoController.reserve);

// POST /api/photos/confirm — confirmer le depot du fichier
photoRouter.post('/confirm', requireConsent, photoController.confirm);

// GET /api/photos/mine — consulter sa pellicule apres publication
photoRouter.get('/mine', photoController.mine);

// GET /api/photos/archive — archive filtree selon le partage choisi par l'hote
photoRouter.get('/archive', photoController.archive);

// POST /api/photos/removal — demander le retrait d'une photographie
photoRouter.post('/removal', photoController.removal);
