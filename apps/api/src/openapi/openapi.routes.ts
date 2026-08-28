// apps/api/src/openapi/openapi.routes.ts
// Exposition de la specification et de son interface de lecture.

import { Router } from 'express';
import { buildOpenApiSpec } from './spec.js';

export const openapiRouter: Router = Router();

// GET /api/openapi.json — la specification brute
openapiRouter.get('/openapi.json', (_req, res) => {
  res.status(200).json(buildOpenApiSpec());
});

// GET /api/docs — interface de lecture, servie sans dependance externe
// autre que le script de rendu.
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
