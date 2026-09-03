// apps/api/src/features/qrkit/qrkit.cards.test.ts
// Composition du kit. La generation du PDF elle-meme n'est pas testee : le
// dessin se verifie a l'oeil sur le fichier produit, le mesurer par des tests
// n'apporterait rien.
//
// Ce qui se teste, c'est ce qui a casse : l'interface promettait « plus une
// affiche pour l'entree » depuis toujours, et la version precedente ne la
// produisait jamais des lors qu'un evenement avait des tables.

import { describe, expect, it } from 'vitest';
import {
  PIECES, PIECES_PAR_DEFAUT, buildJoinUrl, buildPieces, parsePieces, type PieceId,
} from './qrkit.cards.js';

const EVENEMENT = { name: 'Mariage de Lea & Tom', slug: 'lea-et-tom' };
const TABLES = [
  { label: 'Table 1', qrToken: 'jeton-un' },
  { label: 'Table 2', qrToken: 'jeton-deux' },
];

describe('buildPieces', () => {
  it("produit l'affiche d'entree meme quand la soiree a des tables", () => {
    const pieces = buildPieces(EVENEMENT, TABLES, ['affiche-a3', 'cartes']);
    const affiche = pieces.find((p) => p.id === 'affiche-a3');

    expect(affiche, "l'affiche promise a l'hote doit exister").toBeDefined();
    expect(affiche?.cards).toHaveLength(1);
  });

  it("n'encode le jeton de table que sur les cartes de table", () => {
    const pieces = buildPieces(EVENEMENT, TABLES, [...PIECES]);

    for (const piece of pieces) {
      for (const card of piece.cards) {
        // Quelqu'un qui scanne a l'entree, sur un chevalet ou sur un
        // autocollant n'a pas encore de table : l'ecran d'identite la lui
        // demandera si l'hote a active les numeros.
        const attendu = piece.id === 'cartes';
        expect(card.url.includes('?t='), `${piece.id} porte un jeton`).toBe(attendu);
      }
    }
  });

  it('donne une carte par table', () => {
    const [cartes] = buildPieces(EVENEMENT, TABLES, ['cartes']);
    expect(cartes?.cards.map((c) => c.subtitle)).toEqual(['Table 1', 'Table 2']);
  });

  it('imprime le code court et le vrai nombre de poses sur chaque support', () => {
    const pieces = buildPieces(
      { ...EVENEMENT, joinCode: 'LEA624', quotaShots: 10 },
      TABLES,
      [...PIECES],
    );

    for (const piece of pieces) {
      for (const card of piece.cards) {
        expect(card.joinCode).toBe('LEA624');
        expect(card.quotaShots).toBe(10);
      }
    }
  });

  it("retombe sur une carte d'accueil quand il n'y a pas de table", () => {
    const [cartes] = buildPieces(EVENEMENT, [], ['cartes']);
    expect(cartes?.cards).toHaveLength(1);
    expect(cartes?.cards[0]?.url).toBe(buildJoinUrl(EVENEMENT.slug));
  });

  it('rend les pieces de la plus grande a la plus petite, quel que soit l ordre demande', () => {
    const pieces = buildPieces(EVENEMENT, [], ['carton', 'affiche-a2', 'cartes']);
    expect(pieces.map((p) => p.id)).toEqual(['affiche-a2', 'cartes', 'carton']);
  });

  it('garde une affiche imprimable chez soi parmi les pieces par defaut', () => {
    // L'A3 demande un point d'impression ; l'A4 sort de n'importe quelle
    // imprimante, a minuit la veille. C'est la piece sans laquelle personne
    // n'entre dans la soiree.
    expect(PIECES_PAR_DEFAUT).toContain('affiche-a4');
  });

  it('donne a chaque piece un code assez grand pour sa distance de lecture', () => {
    // La regle : la distance fiable vaut environ dix fois le cote du code.
    // Sous vingt-cinq millimetres, l'appareil photo doit faire la mise au
    // point de trop pres.
    for (const piece of buildPieces(EVENEMENT, TABLES, [...PIECES])) {
      expect(piece.qrMm, piece.id).toBeGreaterThanOrEqual(25);
    }
  });
});

describe('parsePieces', () => {
  it('retombe sur les pieces par defaut quand rien n est demande', () => {
    expect(parsePieces(undefined)).toEqual(PIECES_PAR_DEFAUT);
    expect(parsePieces('')).toEqual(PIECES_PAR_DEFAUT);
  });

  it('ignore les identifiants inconnus', () => {
    expect(parsePieces('affiche-a3,poster-geant')).toEqual(['affiche-a3']);
  });

  it('retombe sur les pieces par defaut si tout est invalide', () => {
    expect(parsePieces('n-importe-quoi')).toEqual(PIECES_PAR_DEFAUT);
  });

  it('accepte toutes les pieces du catalogue', () => {
    expect(parsePieces(PIECES.join(','))).toEqual([...PIECES] as PieceId[]);
  });
});
