// apps/api/src/router.ts
// Assemble les routeurs de chaque feature sous un prefixe unique.
// C'est le seul endroit ou l'on voit la carte complete de l'API :
// ajouter un domaine, c'est ajouter une ligne ici.

import { Router } from 'express';
import { authRouter } from './features/auth/auth.routes.js';
import { eventRouter } from './features/events/event.routes.js';
import { guestRouter } from './features/guests/guest.routes.js';
import { photoRouter } from './features/photos/photo.routes.js';
import {
  hostAlbumRouter,
  publicAlbumRouter,
  removalRouter,
} from './features/publication/publication.routes.js';
import { momentRouter } from './features/moments/moment.routes.js';
import { qrkitRouter } from './features/qrkit/qrkit.routes.js';
import { teamRouter } from './features/team/team.routes.js';
import { dashboardRouter } from './features/dashboard/dashboard.routes.js';
import { rollRouter } from './features/guests/roll.routes.js';
import { downloadRouter } from './features/download/download.routes.js';
import { pushRouter } from './features/notifications/push.routes.js';
import { openapiRouter } from './openapi/openapi.routes.js';

export const apiRouter: Router = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/events', eventRouter);
// Parcours invite : aucune route de ce module n'exige de compte.
apiRouter.use('/e', guestRouter);
apiRouter.use('/photos', photoRouter);
// Actions de l'hote sur l'album de son evenement.
apiRouter.use('/events/:id', hostAlbumRouter);
apiRouter.use('/events/:id/moments', momentRouter);
apiRouter.use('/events/:id', qrkitRouter);
apiRouter.use('/events/:id', teamRouter);
apiRouter.use('/events/:id', dashboardRouter);
apiRouter.use('/events/:id', rollRouter);
apiRouter.use('/events/:id', downloadRouter);
apiRouter.use('/push', pushRouter);
// Documentation derivee des schemas Zod.
apiRouter.use('/', openapiRouter);
// Consultation d'un album publie, par son lien de partage.
apiRouter.use('/album', publicAlbumRouter);
apiRouter.use('/removals', removalRouter);
