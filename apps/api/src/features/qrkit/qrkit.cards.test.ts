// apps/api/src/features/qrkit/qrkit.cards.test.ts
// Tests de la composition du kit. La generation du PDF elle-meme n'est pas
// testee ici : c'est du dessin, verifie a l'oeil sur le fichier produit.
// Ce qui compte et se teste, c'est le nombre de cartes et leur contenu.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma.js', () => ({
  prisma: { event: { findUnique: vi.fn() }, eventTable: { findMany: vi.fn() } },
}));

const { buildCards } = await import('./qrkit.cards.js');

const event = { name: 'Mariage de Lea et Sam', slug: 'mariage-lea-sam-7f3a' };

describe('buildCards', () => {
  it('produit une seule carte quand aucune table n est definie', () => {
    const cards = buildCards(event, []);

    expect(cards).toHaveLength(1);
    expect(cards[0]!.subtitle).toBe('Bienvenue');
    // Sans table, l'adresse ne porte aucun parametre.
    expect(cards[0]!.url).not.toContain('?t=');
  });

  it('produit une carte par table, chacune avec son propre jeton', () => {
    const cards = buildCards(event, [
      { label: 'Table 1', qrToken: 'aaa' },
      { label: 'Table 2', qrToken: 'bbb' },
      { label: 'Table 3', qrToken: 'ccc' },
    ]);

    expect(cards).toHaveLength(3);
    expect(cards[0]!.url).toContain('?t=aaa');
    expect(cards[2]!.url).toContain('?t=ccc');
    // Deviner le jeton d'une table ne doit pas donner celui des autres.
    expect(new Set(cards.map((c) => c.url)).size).toBe(3);
  });

  it('porte le nom de l evenement sur chaque carte', () => {
    const cards = buildCards(event, [{ label: 'Table 1', qrToken: 'aaa' }]);
    expect(cards[0]!.title).toBe('Mariage de Lea et Sam');
  });

  it('construit une adresse absolue, scannable hors de l application', () => {
    const cards = buildCards(event, []);
    expect(cards[0]!.url).toMatch(/^https?:\/\/.+\/e\/mariage-lea-sam-7f3a$/);
  });
});
