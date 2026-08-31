// apps/api/src/features/qrkit/qrkit.cards.ts
// Composition du kit imprimable.
//
// Separe du rendu PDF a dessein : ici se decide quelles pieces existent, ce
// qu'elles portent et quelle adresse elles encodent — ce qui se teste. Le
// dessin, lui, se verifie a l'oeil sur le fichier produit.

import { KIT_PIECES, KIT_PIECES_PAR_DEFAUT, KIT_PIECE_INFO, type KitPiece } from '@memora/types';
import { env } from '../../config/env.js';

export interface Card {
  title: string;
  subtitle: string;
  url: string;
}

export const PIECES = KIT_PIECES;
export type PieceId = KitPiece;
export const PIECES_PAR_DEFAUT = KIT_PIECES_PAR_DEFAUT;

export interface Piece {
  id: PieceId;
  label: string;
  /** Format de page, au sens de pdfkit. */
  format: 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  orientation: 'portrait' | 'landscape';
  /**
   * Cote du QR code, en points PostScript (72 par pouce).
   *
   * La regle : la distance de lecture fiable vaut environ dix fois le cote du
   * code. Volontairement prudente — les telephones recents font mieux — mais
   * c'est celle qui tient quand l'affiche est derriere une vitre, en
   * contre-jour, ou tenue par quelqu'un qui a deja bu deux verres.
   */
  qrMm: number;
  cards: Card[];
}

/** Adresse encodee dans le QR code, avec la table si elle est connue. */
export function buildJoinUrl(slug: string, tableToken?: string): string {
  const base = `${env.CLIENT_URL}/e/${slug}`;
  return tableToken ? `${base}?t=${tableToken}` : base;
}

interface EventLike { name: string; slug: string }
type Table = { label: string; qrToken: string };

/**
 * Compose les pieces demandees.
 *
 * L'affiche d'entree est presente quoi qu'il arrive, avec ou sans tables :
 * l'interface la promet a l'hote depuis toujours, et la version precedente ne
 * la produisait jamais des lors qu'un evenement avait des tables. Un hote qui
 * comptait dessus le decouvrait le jour de sa soiree, quand il ne pouvait plus
 * rien y faire.
 *
 * Une seule piece porte le jeton de table : la carte posee sur la table.
 * Quelqu'un qui scanne a l'entree n'a pas encore de table, et l'ecran
 * d'identite la lui demandera si l'hote a active les numeros.
 */
export function buildPieces(
  event: EventLike,
  tables: Table[],
  demandees: PieceId[] = PIECES_PAR_DEFAUT,
): Piece[] {
  const entree = buildJoinUrl(event.slug);
  const bienvenue: Card[] = [{ title: event.name, subtitle: 'Bienvenue', url: entree }];

  const catalogue: Record<PieceId, Piece> = {
    'affiche-a2': {
      id: 'affiche-a2', label: "Affiche d'entrée — très grande salle",
      format: 'A2', orientation: 'portrait', qrMm: 180, cards: bienvenue,
    },
    'affiche-a3': {
      id: 'affiche-a3', label: "Affiche d'entrée",
      format: 'A3', orientation: 'portrait', qrMm: 120, cards: bienvenue,
    },
    'affiche-a4': {
      id: 'affiche-a4', label: KIT_PIECE_INFO['affiche-a4'].label,
      format: 'A4', orientation: 'portrait',
      qrMm: KIT_PIECE_INFO['affiche-a4'].qrMm, cards: bienvenue,
    },
    cartes: {
      id: 'cartes', label: KIT_PIECE_INFO['cartes'].label,
      format: 'A5', orientation: 'landscape',
      qrMm: KIT_PIECE_INFO['cartes'].qrMm,
      // Sans tables, la carte de table reste utile : on la pose au bar ou a
      // l'entree, et elle porte alors la meme adresse que l'affiche.
      cards: tables.length === 0
        ? bienvenue
        : tables.map((table) => ({
            title: event.name,
            subtitle: table.label,
            url: buildJoinUrl(event.slug, table.qrToken),
          })),
    },
    chevalet: {
      id: 'chevalet', label: KIT_PIECE_INFO['chevalet'].label,
      format: 'A5', orientation: 'portrait',
      qrMm: KIT_PIECE_INFO['chevalet'].qrMm, cards: bienvenue,
    },
    autocollants: {
      id: 'autocollants', label: KIT_PIECE_INFO['autocollants'].label,
      format: 'A4', orientation: 'portrait',
      qrMm: KIT_PIECE_INFO['autocollants'].qrMm, cards: bienvenue,
    },
    carton: {
      id: 'carton', label: KIT_PIECE_INFO['carton'].label,
      format: 'A6', orientation: 'portrait',
      qrMm: KIT_PIECE_INFO['carton'].qrMm, cards: bienvenue,
    },
  };

  const voulues = demandees.length > 0 ? demandees : PIECES_PAR_DEFAUT;
  // L'ordre du catalogue prime sur celui de la demande : un kit se lit de la
  // plus grande piece a la plus petite, quel que soit l'ordre des cases cochees.
  return PIECES.filter((id) => voulues.includes(id)).map((id) => catalogue[id]);
}

/** Les identifiants valides, pour la lecture d'un parametre de requete. */
export function parsePieces(brut: string | undefined): PieceId[] {
  if (!brut) return PIECES_PAR_DEFAUT;
  const demandees = brut.split(',').map((s) => s.trim()).filter(Boolean);
  const valides = demandees.filter((id): id is PieceId => (PIECES as readonly string[]).includes(id));
  return valides.length > 0 ? valides : PIECES_PAR_DEFAUT;
}
