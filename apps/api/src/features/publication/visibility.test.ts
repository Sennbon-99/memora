// apps/api/src/features/publication/visibility.test.ts
// Tests du moteur de visibilite. Aucune base, aucun reseau : la fonction
// est pure, donc chaque combinaison possible est verifiable directement.

import { describe, expect, it } from 'vitest';
import { canSeePhoto, filterVisible, type Viewer } from './visibility.js';

const host: Viewer = { kind: 'HOST' };
const author: Viewer = { kind: 'GUEST', rollId: 'r1' };
const otherGuest: Viewer = { kind: 'GUEST', rollId: 'r2' };
const linkHolder: Viewer = { kind: 'LINK' };

const photo = { rollId: 'r1', published: true, hidden: false };
const published = (scope: 'NONE' | 'EVERYONE' | 'SELECTED' | 'OWN_ONLY') =>
  ({ isPublished: true, scope }) as const;

describe('avant publication', () => {
  const draft = { isPublished: false, scope: 'EVERYONE' } as const;

  it("l'hote voit tout, y compris avant publication", () => {
    expect(canSeePhoto(draft, photo, host)).toBe(true);
  });

  it("l'auteur de la photographie ne la voit pas", () => {
    // C'est le principe du produit : on shoote a l'aveugle.
    expect(canSeePhoto(draft, photo, author)).toBe(false);
  });

  it('un detenteur du lien ne voit rien', () => {
    expect(canSeePhoto(draft, photo, linkHolder)).toBe(false);
  });
});

describe('photographie masquee', () => {
  const hidden = { ...photo, hidden: true };

  it("reste visible de l'hote, qui doit arbitrer la demande de retrait", () => {
    expect(canSeePhoto(published('EVERYONE'), hidden, host)).toBe(true);
  });

  it('disparait pour tous les autres, quelle que soit la portee', () => {
    for (const scope of ['EVERYONE', 'SELECTED', 'OWN_ONLY'] as const) {
      expect(canSeePhoto(published(scope), hidden, author)).toBe(false);
      expect(canSeePhoto(published(scope), hidden, otherGuest)).toBe(false);
      expect(canSeePhoto(published(scope), hidden, linkHolder)).toBe(false);
    }
  });
});

describe('photographie non retenue au tri', () => {
  const notPicked = { ...photo, published: false };

  it("n'est visible de personne, meme de son auteur", () => {
    expect(canSeePhoto(published('OWN_ONLY'), notPicked, author)).toBe(false);
    expect(canSeePhoto(published('EVERYONE'), notPicked, linkHolder)).toBe(false);
  });
});

describe('portee NONE', () => {
  it("l'hote a publie sans partager : personne d'autre ne voit", () => {
    expect(canSeePhoto(published('NONE'), photo, author)).toBe(false);
    expect(canSeePhoto(published('NONE'), photo, linkHolder)).toBe(false);
    expect(canSeePhoto(published('NONE'), photo, host)).toBe(true);
  });
});

describe('portee EVERYONE', () => {
  it('tout le monde voit tout', () => {
    expect(canSeePhoto(published('EVERYONE'), photo, author)).toBe(true);
    expect(canSeePhoto(published('EVERYONE'), photo, otherGuest)).toBe(true);
    expect(canSeePhoto(published('EVERYONE'), photo, linkHolder)).toBe(true);
  });
});

describe('portee SELECTED', () => {
  it('seuls les detenteurs du lien voient', () => {
    expect(canSeePhoto(published('SELECTED'), photo, linkHolder)).toBe(true);
  });

  it("un invite sans le lien ne voit rien, meme ses propres photographies", () => {
    expect(canSeePhoto(published('SELECTED'), photo, author)).toBe(false);
  });
});

describe('portee OWN_ONLY', () => {
  it("l'auteur voit sa propre photographie", () => {
    expect(canSeePhoto(published('OWN_ONLY'), photo, author)).toBe(true);
  });

  it("un autre invite ne voit pas la pellicule d'autrui", () => {
    // C'est le test qui garantit l'absence de fuite entre pellicules.
    expect(canSeePhoto(published('OWN_ONLY'), photo, otherGuest)).toBe(false);
  });

  it("un detenteur du lien n'ayant pas participe ne voit rien", () => {
    expect(canSeePhoto(published('OWN_ONLY'), photo, linkHolder)).toBe(false);
  });
});

describe('filterVisible', () => {
  it('ne laisse a chaque invite que sa propre pellicule', () => {
    const photos = [
      { rollId: 'r1', published: true, hidden: false },
      { rollId: 'r2', published: true, hidden: false },
      { rollId: 'r1', published: true, hidden: true },
    ];

    const visible = filterVisible(published('OWN_ONLY'), photos, author);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.rollId).toBe('r1');
  });
});
