// apps/api/src/features/qrkit/qrkit.compo.test.ts
// La composition des affiches, mesuree dans le PDF produit.
//
// Le corps du texte d'une affiche suit la taille de son code : une A2 se lit
// de plus loin qu'une A4. Les ecarts entre les lignes doivent suivre le meme
// facteur, sinon la composition ne tient que pour le format sur lequel elle
// a ete reglee. C'etait le cas : ecarts en millimetres fixes, corps
// proportionnel, et sur l'A2 les deux consignes se touchaient exactement.
//
// Ce test ne relit pas les coordonnees du source. Il decompresse le flux de
// contenu, y lit les operateurs Tf (corps) et Tm (position de la ligne de
// base), et verifie la geometrie que le papier portera vraiment.

import { describe, expect, it, vi } from 'vitest';
import zlib from 'node:zlib';

vi.mock('../../config/prisma.js', () => ({ prisma: {} }));
vi.mock('../events/event.service.js', () => ({ assertCanManage: vi.fn() }));

const { buildPieces } = await import('./qrkit.cards.js');
const { buildPiece } = await import('./qrkit.service.js');

// Helvetica, en fractions du corps. Ce sont les valeurs de la police elle-meme :
// une majuscule accentuee monte a 0,718 au-dessus de la ligne de base, la
// jambe d'un « p » descend a 0,207 en dessous.
const HAUT = 0.718;
const BAS = 0.207;

/** Un nom de soiree assez long pour passer a la ligne sur toutes les affiches. */
const EVENEMENT = {
  name: 'Le mariage de Léa Vandenberghe et Tom Castellane',
  slug: 'lea-et-tom',
};
const TABLES = [{ label: 'Table 1', qrToken: 'jeton-un' }];

interface Ligne {
  /** Distance du haut de la page a la ligne de base, en points. */
  base: number;
  corps: number;
  texte: string;
}

/** Les lignes de texte du PDF, dans l'ordre ou elles sont dessinees. */
function lignesDuPdf(pdf: Buffer, hauteurPage: number): Ligne[] {
  const brut = pdf.toString('latin1');
  const lignes: Ligne[] = [];

  for (const bloc of brut.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let clair: Buffer;
    try {
      clair = zlib.inflateSync(Buffer.from(bloc[1] as string, 'latin1'));
    } catch {
      continue; // Les images du code : compressees autrement, sans texte.
    }
    const contenu = clair.toString('latin1');
    if (!contenu.includes('TJ')) continue;

    // BT ... Tm ... Tf ... TJ ... ET : un bloc de texte pose.
    for (const bt of contenu.matchAll(/BT([\s\S]*?)ET/g)) {
      const corps = (bt[1] as string).match(/\/F\d+\s+([\d.]+)\s+Tf/);
      const tm = (bt[1] as string).match(/1 0 0 1 [\d.-]+ ([\d.-]+) Tm/);
      if (!corps || !tm) continue;

      let texte = '';
      for (const hex of (bt[1] as string).matchAll(/<([0-9a-f]+)>/gi)) {
        texte += Buffer.from(hex[1] as string, 'hex').toString('latin1');
      }
      // Le repere du PDF part du bas ; la page est retournee au dessin.
      lignes.push({
        base: hauteurPage - Number(tm[1]),
        corps: Number(corps[1]),
        texte,
      });
    }
  }
  return lignes;
}

/** Hauteur de page, en points, telle que pdfkit l'ecrit. */
function hauteurDe(pdf: Buffer): number {
  const boite = pdf.toString('latin1').match(/\/MediaBox\s*\[[\d.\s]*?([\d.]+)\s*\]/);
  return Number(boite?.[1]);
}

describe('la composition des affiches', () => {
  it.each(['affiche-a2', 'affiche-a3', 'affiche-a4'])(
    '%s : aucune ligne n en touche une autre',
    async (id) => {
      const [affiche] = buildPieces(EVENEMENT, TABLES, [id as never]);
      const pdf = await buildPiece(affiche!);
      const lignes = lignesDuPdf(pdf, hauteurDe(pdf));

      expect(lignes.length, 'aucun texte trouve dans le PDF').toBeGreaterThan(3);

      for (let i = 1; i < lignes.length; i += 1) {
        const dessus = lignes[i - 1] as Ligne;
        const dessous = lignes[i] as Ligne;
        // La jambe basse de la ligne du dessus et la hampe haute de celle du
        // dessous doivent tenir dans l'ecart des deux lignes de base.
        const requis = dessus.corps * BAS + dessous.corps * HAUT;
        const reel = dessous.base - dessus.base;

        expect(
          reel,
          `« ${dessous.texte.slice(0, 28)} » chevauche « ${dessus.texte.slice(0, 28)} » `
            + `(${reel.toFixed(1)} pt d'ecart, ${requis.toFixed(1)} necessaires)`,
        ).toBeGreaterThanOrEqual(requis);
      }
    },
  );

  it('garde la meme composition d une affiche a l autre', async () => {
    // Le rapport entre les ecarts et le corps doit etre le meme aux trois
    // formats : c'est ce qui fait qu'une A2 est une A3 agrandie, et non une
    // autre affiche. Sans cette invariance, chaque format demanderait son
    // propre reglage — et seul celui qu'on imprime serait juste.
    const rapports = await Promise.all(
      ['affiche-a2', 'affiche-a3', 'affiche-a4'].map(async (id) => {
        const [affiche] = buildPieces(EVENEMENT, TABLES, [id as never]);
        const pdf = await buildPiece(affiche!);
        const lignes = lignesDuPdf(pdf, hauteurDe(pdf));
        const consigne = lignes.find((l) => l.texte.startsWith('Scannez')) as Ligne;
        const suite = lignes.find((l) => l.texte.startsWith('Vingt-quatre')) as Ligne;
        return (suite.base - consigne.base) / consigne.corps;
      }),
    );

    const [a2, a3, a4] = rapports as [number, number, number];
    expect(a2).toBeCloseTo(a3, 2);
    expect(a4).toBeCloseTo(a3, 2);
  });
});
