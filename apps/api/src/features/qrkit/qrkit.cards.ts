// apps/api/src/features/qrkit/qrkit.cards.ts
// Composition du kit de QR codes.
//
// Separe du rendu PDF a dessein : ici se decide le nombre de cartes et leur
// contenu, ce qui se teste. Le dessin, lui, se verifie a l'oeil sur le fichier
// produit — le mesurer par des tests n'apporterait rien.

import { env } from '../../config/env.js';

export interface Card {
  title: string;
  subtitle: string;
  url: string;
}

/** Adresse encodee dans le QR code, avec la table si elle est connue. */
export function buildJoinUrl(slug: string, tableToken?: string): string {
  const base = `${env.CLIENT_URL}/e/${slug}`;
  return tableToken ? `${base}?t=${tableToken}` : base;
}

/**
 * Compose les cartes du kit. Deux cas : un code unique a poser a l'entree,
 * ou un code par table lorsque l'hote a choisi de les distinguer.
 */
export function buildCards(
  event: { name: string; slug: string },
  tables: { label: string; qrToken: string }[],
): Card[] {
  if (tables.length === 0) {
    return [{ title: event.name, subtitle: 'Bienvenue', url: buildJoinUrl(event.slug) }];
  }
  return tables.map((table) => ({
    title: event.name,
    subtitle: table.label,
    url: buildJoinUrl(event.slug, table.qrToken),
  }));
}
