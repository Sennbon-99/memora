// 🚏 apps/api/src/features/events/event.routes.ts
import { Router } from 'express';
import { createEventSchema, updateEventSchema } from '@memora/types';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as eventController from './event.controller.js';

export const eventRouter = Router();

// Toutes les routes de ce module supposent un hote authentifie.
eventRouter.use(requireAuth);

// 🧠 POST /api/events — creer un evenement (etat brouillon)
eventRouter.post('/', validate(createEventSchema), eventController.create);

// 🧠 GET /api/events — lister ses evenements
eventRouter.get('/', eventController.list);

// 🧠 GET /api/events/:id — detail d'un evenement
eventRouter.get('/:id', eventController.detail);

// 🧠 PATCH /api/events/:id — modifier la configuration
eventRouter.patch('/:id', validate(updateEventSchema), eventController.update);

// 🧠 POST /api/events/:id/open — ouvrir la prise de vue
eventRouter.post('/:id/open', eventController.open);

// 🧠 POST /api/events/:id/close — cloturer par anticipation
eventRouter.post('/:id/close', eventController.close);

// 🧠 POST /api/events/:id/tables — creer les tables et leurs QR codes
eventRouter.post('/:id/tables', eventController.createTables);
