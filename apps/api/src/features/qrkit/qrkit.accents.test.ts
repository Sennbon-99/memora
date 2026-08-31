// apps/api/src/features/qrkit/qrkit.accents.test.ts
// Les accents des textes imprimes, lus dans le PDF produit.
//
// La convention du depot separe deux choses : les commentaires du code
// s'ecrivent sans accent, ce que lit un utilisateur les porte tous. Le kit
// imprime etait le dernier endroit a l'enfreindre, et c'est le pire : une
// affiche mal accentuee reste sur un mur toute la soiree, et personne ne
// peut la corriger.
//
// Le test ne relit pas les chaines du source — ce serait verifier que la
// constante vaut la constante. Il decompresse le flux de contenu du PDF et
// y cherche les mots accentues, parce que c'est la que le defaut se
// produirait : une police qui ne sait pas encoder « e accent grave »
// n'echoue pas, elle imprime autre chose.

import { describe, expect, it, vi } from 'vitest';
import zlib from 'node:zlib';

vi.mock('../../config/prisma.js', () => ({ prisma: {} }));
vi.mock('../events/event.service.js', () => ({ assertCanManage: vi.fn() }));

const { buildPieces } = await import('./qrkit.cards.js');
const { buildPiece } = await import('./qrkit.service.js');

const EVENEMENT = { name: 'Mariage de Lea & Tom', slug: 'lea-et-tom' };
const TABLES = [{ label: 'Table 1', qrToken: 'jeton-un' }];

/**
 * Le texte reellement dessine dans le PDF.
 *
 * pdfkit ecrit les chaines en hexadecimal dans des tableaux TJ, et encode
 * les polices standard en WinAnsi. Pour les accents francais, WinAnsi et
 * latin1 coincident octet pour octet — ils ne divergent que sur la plage
 * 0x80-0x9F, ou ne vit aucune lettre accentuee.
 */
function texteDuPdf(pdf: Buffer): string {
  const brut = pdf.toString('latin1');
  let sortie = '';
  for (const bloc of brut.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let clair: Buffer;
    try {
      clair = zlib.inflateSync(Buffer.from(bloc[1] as string, 'latin1'));
    } catch {
      // Les images du QR code : compressees autrement, et sans texte.
      continue;
    }
    const contenu = clair.toString('latin1');
    if (!contenu.includes('TJ')) continue;
    for (const hex of contenu.matchAll(/<([0-9a-f]+)>/gi)) {
      sortie += Buffer.from(hex[1] as string, 'hex').toString('latin1');
    }
    sortie += '\n';
  }
  return sortie;
}

describe('les textes imprimes', () => {
  it.each([
    ['affiche-a3', ['à installer', 'se révèlent', 'même temps']],
    ['affiche-a4', ['à installer', 'se révèlent']],
    ['cartes', ['à installer']],
    ['chevalet', ['à installer']],
    ['autocollants', ['Découpez']],
  ])('%s porte ses accents', async (id, attendus) => {
    const [piece] = buildPieces(EVENEMENT, TABLES, [id as never]);
    const texte = texteDuPdf(await buildPiece(piece!));

    for (const mot of attendus) {
      expect(texte, `« ${mot} » n'est pas dans le PDF de ${id}`).toContain(mot);
    }
  });

  // Le defaut d'origine : la meme phrase, sans ses accents. Si elle
  // reapparaissait, le test ci-dessus passerait toujours sur les autres
  // pieces et celui-la seul tomberait.
  it('ne laisse plus passer un francais sans accent', async () => {
    const [affiche] = buildPieces(EVENEMENT, TABLES, ['affiche-a3']);
    const texte = texteDuPdf(await buildPiece(affiche!));

    expect(texte).not.toContain('application a installer');
    expect(texte).not.toContain('se revelent');
    expect(texte).not.toContain('meme temps');
  });
});
