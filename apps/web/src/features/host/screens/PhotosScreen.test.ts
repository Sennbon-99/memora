// apps/web/src/features/host/screens/PhotosScreen.test.ts
// La regle de publication est la seule logique de cet ecran, et c'est la
// plus consequente du produit : elle decide ce que les invites verront.

import { describe, expect, it } from 'vitest';
import { countReadyToPublish } from './PhotosScreen.js';

const roll = (id: string, reviewed: boolean) => ({ id, reviewed });
const photo = (rollId: string, status: string, published: boolean) => ({ rollId, status, published });

describe('countReadyToPublish', () => {
  it('compte les photographies gardees des pellicules triees', () => {
    expect(countReadyToPublish(
      [photo('r1', 'UPLOADED', false), photo('r1', 'UPLOADED', false)],
      [roll('r1', true)],
    )).toBe(2);
  });

  it('ignore les pellicules jamais ouvertes', () => {
    // Publier ce que personne n a regarde est exactement ce que le tri
    // doit empecher : une photographie genante passerait sans controle.
    expect(countReadyToPublish(
      [photo('r2', 'UPLOADED', false), photo('r2', 'UPLOADED', false)],
      [roll('r2', false)],
    )).toBe(0);
  });

  it('ignore les photographies masquees pendant le tri', () => {
    expect(countReadyToPublish(
      [photo('r1', 'HIDDEN', false), photo('r1', 'UPLOADED', false)],
      [roll('r1', true)],
    )).toBe(1);
  });

  it('ignore ce qui est deja publie, pour ne pas le recompter', () => {
    // Sinon le bouton annoncerait « publier 24 photographies » alors que
    // vingt sont deja en ligne depuis la publication precedente.
    expect(countReadyToPublish(
      [photo('r1', 'UPLOADED', true), photo('r1', 'UPLOADED', false)],
      [roll('r1', true)],
    )).toBe(1);
  });

  it('melange plusieurs pellicules a des etats differents', () => {
    expect(countReadyToPublish(
      [
        photo('r1', 'UPLOADED', false),   // triee, gardee, a publier
        photo('r1', 'HIDDEN', false),     // triee, masquee
        photo('r2', 'UPLOADED', false),   // pas triee
        photo('r3', 'UPLOADED', true),    // deja publiee
        photo('r3', 'UPLOADED', false),   // triee, gardee, a publier
      ],
      [roll('r1', true), roll('r2', false), roll('r3', true)],
    )).toBe(2);
  });

  it('rend zero quand il n y a rien', () => {
    expect(countReadyToPublish([], [])).toBe(0);
  });
});
