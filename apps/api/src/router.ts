// apps/api/src/router.ts
// Assemble les routeurs de chaque feature sous un prefixe unique.
// C'est le seul endroit ou l'on voit la carte complete de l'API :
// ajouter un domaine, c'est ajouter une ligne ici.

import { Router } from 'express';
import { authRouter } from './features/auth/auth.routes.js';
import { eventRouter } from './features/events/event.routes.js';
import { guestRouter } from './features/guests/guest.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/events', eventRouter);
// Parcours invite : aucune route de ce module n'exige de compte.
apiRouter.use('/e', guestRouter);
