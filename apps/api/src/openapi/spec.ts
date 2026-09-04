// apps/api/src/openapi/spec.ts
// Specification OpenAPI derivee des schemas Zod.
//
// Le point central : la documentation n'est pas ecrite, elle est deduite des
// schemas qui valident deja les entrees. Une regle de validation qui change
// change la documentation a la compilation suivante, sans intervention.
// Il devient impossible de documenter une route autrement qu'elle ne
// se comporte reellement.

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodSchema } from 'zod';
import {
  confirmPhotoSchema,
  createEventSchema,
  createMomentSchema,
  joinEventSchema,
  loginSchema,
  publishEventSchema,
  registerSchema,
  removalRequestSchema,
  reservePhotoSchema,
  updateEventSchema,
} from '@memora/types';

/** Convertit un schema Zod en schema JSON exploitable par OpenAPI. */
function toSchema(schema: ZodSchema): unknown {
  return zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
}

interface RouteDoc {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  summary: string;
  tag: string;
  auth: 'host' | 'guest' | 'public';
  body?: ZodSchema;
}

/**
 * Les routes exposees, avec leur schema d'entree.
 *
 * Cette liste est le seul endroit ou l'API se decrit elle-meme. Les corps
 * de requete ne sont pas retranscrits : ce sont les memes objets Zod que
 * ceux passes a validate() dans les routeurs.
 */
const routes: RouteDoc[] = [
  { method: 'post', path: '/auth/register', summary: 'Creer un compte hote', tag: 'Authentification', auth: 'public', body: registerSchema },
  { method: 'post', path: '/auth/login', summary: 'Ouvrir une session', tag: 'Authentification', auth: 'public', body: loginSchema },
  { method: 'post', path: '/auth/refresh', summary: 'Renouveler le jeton d acces', tag: 'Authentification', auth: 'public' },
  { method: 'post', path: '/auth/logout', summary: 'Fermer la session', tag: 'Authentification', auth: 'host' },
  { method: 'get', path: '/auth/me', summary: 'Profil de l utilisateur connecte', tag: 'Authentification', auth: 'host' },

  { method: 'post', path: '/events', summary: 'Creer un evenement', tag: 'Evenements', auth: 'host', body: createEventSchema },
  { method: 'get', path: '/events', summary: 'Lister ses evenements', tag: 'Evenements', auth: 'host' },
  { method: 'get', path: '/events/{id}', summary: 'Detail d un evenement', tag: 'Evenements', auth: 'host' },
  { method: 'patch', path: '/events/{id}', summary: 'Modifier la configuration', tag: 'Evenements', auth: 'host', body: updateEventSchema },
  { method: 'post', path: '/events/{id}/open', summary: 'Ouvrir la prise de vue', tag: 'Evenements', auth: 'host' },
  { method: 'post', path: '/events/{id}/close', summary: 'Cloturer par anticipation', tag: 'Evenements', auth: 'host' },
  { method: 'get', path: '/events/{id}/qr-kit', summary: 'Telecharger le kit de QR codes', tag: 'Evenements', auth: 'host' },
  { method: 'get', path: '/events/{id}/stats', summary: 'Participation en direct', tag: 'Evenements', auth: 'host' },

  { method: 'get', path: '/e/{slug}', summary: 'Rejoindre un evenement par QR code ou code court', tag: 'Invites', auth: 'public' },
  { method: 'post', path: '/e/{slug}/consent', summary: 'Accepter le droit a l image', tag: 'Invites', auth: 'guest' },
  { method: 'post', path: '/e/{slug}/identity', summary: 'Renseigner prenom et table', tag: 'Invites', auth: 'guest', body: joinEventSchema },
  { method: 'post', path: '/e/{slug}/decline', summary: 'Refuser le droit a l image et effacer sa pellicule', tag: 'Invites', auth: 'guest' },
  { method: 'get', path: '/e/{slug}/recovery-link', summary: 'Creer son lien personnel de recuperation', tag: 'Invites', auth: 'guest' },
  { method: 'post', path: '/e/{slug}/recovery-link', summary: 'Retrouver sa pellicule par son lien personnel', tag: 'Invites', auth: 'public' },

  { method: 'post', path: '/photos/reserve', summary: 'Reserver une pose', tag: 'Photographies', auth: 'guest', body: reservePhotoSchema },
  { method: 'post', path: '/photos/confirm', summary: 'Confirmer le depot du fichier', tag: 'Photographies', auth: 'guest', body: confirmPhotoSchema },
  { method: 'get', path: '/photos/mine', summary: 'Consulter sa pellicule', tag: 'Photographies', auth: 'guest' },
  { method: 'get', path: '/photos/archive', summary: 'Telecharger les photographies partagees', tag: 'Photographies', auth: 'guest' },
  { method: 'post', path: '/photos/removal', summary: 'Demander le retrait d une photographie', tag: 'Photographies', auth: 'guest', body: removalRequestSchema },

  { method: 'get', path: '/events/{id}/album', summary: 'Album complet pour le tri', tag: 'Publication', auth: 'host' },
  { method: 'post', path: '/events/{id}/publish', summary: 'Publier selon une portee', tag: 'Publication', auth: 'host', body: publishEventSchema },
  { method: 'get', path: '/events/{id}/archive', summary: 'Telecharger l album en archive', tag: 'Publication', auth: 'host' },
  { method: 'get', path: '/album/{token}', summary: 'Consulter un album publie', tag: 'Publication', auth: 'public' },
  { method: 'post', path: '/removals/{id}', summary: 'Arbitrer une demande de retrait', tag: 'Publication', auth: 'host' },

  { method: 'post', path: '/events/{id}/moments', summary: 'Programmer un moment fort', tag: 'Moments', auth: 'host', body: createMomentSchema },
  { method: 'get', path: '/events/{id}/moments', summary: 'Programme de la soiree', tag: 'Moments', auth: 'host' },
  { method: 'post', path: '/events/{id}/moments/{momentId}/trigger', summary: 'Ouvrir la fenetre de capture', tag: 'Moments', auth: 'host' },
  { method: 'post', path: '/events/{id}/moments/{momentId}/close', summary: 'Clore un moment', tag: 'Moments', auth: 'host' },

  { method: 'post', path: '/events/{id}/co-hosts', summary: 'Inviter un co-hote', tag: 'Equipe', auth: 'host' },
  { method: 'get', path: '/events/{id}/co-hosts', summary: 'Lister les co-hotes', tag: 'Equipe', auth: 'host' },
  { method: 'delete', path: '/events/{id}/co-hosts/{userId}', summary: 'Retirer un co-hote', tag: 'Equipe', auth: 'host' },

  { method: 'post', path: '/push/subscribe', summary: 'S abonner aux notifications', tag: 'Notifications', auth: 'guest' },
];

/** Reponses d'erreur communes, decrites une seule fois. */
const errorResponse = {
  description: 'Erreur',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'QUOTA_EXHAUSTED' },
          message: { type: 'string' },
          traceId: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
};

/** Construit la specification complete. */
export function buildOpenApiSpec(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const params = [...route.path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
      name, in: 'path', required: true, schema: { type: 'string' },
    }));

    paths[route.path] ??= {};
    paths[route.path]![route.method] = {
      tags: [route.tag],
      summary: route.summary,
      security: route.auth === 'host' ? [{ bearerAuth: [] }] : [],
      ...(params.length > 0 ? { parameters: params } : {}),
      ...(route.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: toSchema(route.body) } },
            },
          }
        : {}),
      responses: {
        '200': { description: 'Succes' },
        '401': errorResponse,
        '403': errorResponse,
        '404': errorResponse,
        '409': errorResponse,
        '422': {
          ...errorResponse,
          description: 'Données invalides — le detail des champs est renvoye',
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'API Memora',
      version: '1.0.0',
      description:
        "Interface de programmation de Memora. Les schemas de requete sont derives " +
        "des memes objets Zod que ceux qui valident les entrees : la documentation " +
        'ne peut pas diverger du comportement reel.',
    },
    servers: [{ url: '/api' }],
    tags: [...new Set(routes.map((r) => r.tag))].map((name) => ({ name })),
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths,
  };
}
