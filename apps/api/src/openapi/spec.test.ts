// apps/api/src/openapi/spec.test.ts
// La specification est derivee des schemas Zod : ces tests verifient que la
// derivation produit bien ce que l'API fait reellement.

import { describe, expect, it } from 'vitest';
import { buildOpenApiSpec } from './spec.js';

const spec = buildOpenApiSpec() as {
  paths: Record<string, Record<string, {
    security?: unknown[];
    requestBody?: { content: { 'application/json': { schema: { properties?: Record<string, unknown>; required?: string[] } } } };
  }>>;
  tags: { name: string }[];
};

describe('specification OpenAPI', () => {
  it('couvre toutes les familles de routes', () => {
    expect(spec.tags.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'Authentification', 'Evenements', 'Invites', 'Photographies',
        'Publication', 'Moments', 'Equipe', 'Notifications',
      ]),
    );
  });

  it('exige un jeton sur les routes de l hote, pas sur celles de l invite', () => {
    expect(spec.paths['/events']!.post!.security).toHaveLength(1);
    // Le parcours invite ne demande aucun compte : c'est la promesse du produit.
    expect(spec.paths['/e/{slug}']!.get!.security).toHaveLength(0);
  });

  it('derive les contraintes de validation reelles, pas une description a la main', () => {
    const body = spec.paths['/events']!.post!.requestBody!.content['application/json'].schema;
    const quota = body.properties!.quotaShots as { minimum: number; maximum: number };

    // Les bornes viennent du schema Zod, lui-meme aligne sur les constantes
    // partagees : impossible de documenter 5-60 si le code accepte autre chose.
    expect(quota.minimum).toBe(5);
    expect(quota.maximum).toBe(60);
  });

  it('marque comme obligatoires les champs que Zod exige', () => {
    const body = spec.paths['/auth/register']!.post!.requestBody!.content['application/json'].schema;
    expect(body.required).toEqual(expect.arrayContaining(['email', 'password', 'name']));
  });

  it('declare les parametres de chemin', () => {
    const route = spec.paths['/events/{id}/moments/{momentId}/trigger']!.post as {
      parameters: { name: string }[];
    };
    expect(route.parameters.map((p) => p.name)).toEqual(['id', 'momentId']);
  });

  it('documente la reponse 422 avec le detail des champs', () => {
    const responses = (spec.paths['/auth/login']!.post as { responses: Record<string, { description: string }> }).responses;
    expect(responses['422']!.description).toContain('champs');
  });
});
