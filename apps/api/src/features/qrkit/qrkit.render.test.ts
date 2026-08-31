// apps/api/src/features/qrkit/qrkit.render.test.ts
// Le dessin des pieces, rendu pour de vrai.
//
// pdfkit leve sur une coordonnee invalide, et une piece qui ne se dessine pas
// ne se voit qu'au moment ou l'hote la telecharge — c'est-a-dire la veille de
// sa soiree. Ce test rend les sept pieces et verifie qu'elles produisent un
// PDF plausible ; il ne juge pas leur apparence, qui se regarde a l'oeil sur
// le fichier produit.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma.js', () => ({ prisma: {} }));
vi.mock('../events/event.service.js', () => ({ assertCanManage: vi.fn() }));

const { PIECES, buildPieces } = await import('./qrkit.cards.js');
const { buildPiece } = await import('./qrkit.service.js');

const EVENEMENT = { name: 'Mariage de Lea & Tom', slug: 'lea-et-tom' };
const TABLES = [
  { label: 'Table 1', qrToken: 'jeton-un' },
  { label: 'Table 2', qrToken: 'jeton-deux' },
];

describe('le rendu des pieces', () => {
  it.each([...PIECES])('dessine %s sans lever', async (id) => {
    const [piece] = buildPieces(EVENEMENT, TABLES, [id]);
    const pdf = await buildPiece(piece!);

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // Une page vide pese environ un kilo-octet ; une page portant un QR code
    // en pese plusieurs. En dessous, c'est que rien n'a ete dessine.
    expect(pdf.length, `${id} parait vide`).toBeGreaterThan(4000);
  });

  it('produit une page par table sur les cartes', async () => {
    const [cartes] = buildPieces(EVENEMENT, TABLES, ['cartes']);
    const pdf = await buildPiece(cartes!);
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages).toHaveLength(2);
  });
});

describe('la planche d autocollants', () => {
  // Le defaut qui a motive ce test : un code de 35 mm dans un cercle de
  // 48 mm. La diagonale valait 49,5 mm, et le decalage vers le haut portait
  // le coin le plus eloigne a 26,2 mm du centre pour un rayon de 24. Rien ne
  // se voyait a l'ecran — le debordement n'apparait qu'une fois decoupe.
  it('garde les coins du code a l interieur du cercle de decoupe', async () => {
    const { PLANCHE } = await import('./qrkit.service.js');
    const { KIT_PIECE_INFO } = await import('@memora/types');

    const rayon = PLANCHE.pasMm / 2 - PLANCHE.margeMm;
    const demi = KIT_PIECE_INFO.autocollants.qrMm / 2;
    // Le coin haut, le plus proche du bord a cause du decalage.
    const coin = Math.hypot(demi, demi + PLANCHE.decalageMm);

    // Un millimetre de marge : personne ne decoupe au trait pres.
    expect(rayon - coin).toBeGreaterThanOrEqual(1);
  });

  it('fait tenir la grille dans la largeur de la page', async () => {
    const { PLANCHE } = await import('./qrkit.service.js');
    const LARGEUR_A4_MM = 210;
    expect(PLANCHE.colonnes * PLANCHE.pasMm).toBeLessThanOrEqual(LARGEUR_A4_MM);
  });
});
