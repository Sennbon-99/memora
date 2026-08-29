// apps/api/src/openapi/openapi.routes.ts
// Exposition de la specification et de son interface de lecture.

import { Router } from 'express';
import helmet from 'helmet';
import { buildOpenApiSpec } from './spec.js';

export const openapiRouter: Router = Router();

/** Origine du script qui rend la specification. */
const SCALAR = 'https://cdn.jsdelivr.net';

// GET /api/openapi.json — la specification brute
openapiRouter.get('/openapi.json', (_req, res) => {
  res.status(200).json(buildOpenApiSpec());
});

/**
 * Assouplissement de la politique de securite, pour cette route seulement.
 *
 * La politique globale interdit tout script exterieur, ce qui est la bonne
 * regle pour une application qui manipule des photographies privees. Mais
 * elle rendait cette page-ci definitivement vide : le navigateur bloquait
 * le script de rendu, et la route repondait 200 sans rien afficher.
 *
 * L'exception est donc portee ici et nulle part ailleurs, avec la liste des
 * origines reduite au strict necessaire. La page ne montre que la
 * specification, qui est publique par nature.
 */
openapiRouter.use('/docs', helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", SCALAR],
    styleSrc: ["'self'", "'unsafe-inline'", SCALAR],
    fontSrc: ["'self'", SCALAR, 'data:'],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
  },
}));

// GET /api/docs — interface de lecture de la specification.
openapiRouter.get('/docs', (_req, res) => {
  res.status(200).type('html').send(`<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>API Memora</title></head>
<body>
  <script id="api-reference" data-url="/api/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});
