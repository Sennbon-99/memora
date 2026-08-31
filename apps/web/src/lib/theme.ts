// apps/web/src/lib/theme.ts
// Application du carnet choisi par l'hote.
//
// Un seul point d'injection, comme avant : on pose un attribut sur l'element
// racine, et la feuille de style fait le reste. La difference avec la version
// precedente est ce qui voyage — non plus une couleur d'accent, mais le nom
// d'un carnet, qui porte a lui seul les surfaces, les encres, les filets, les
// formes et l'etalonnage des photographies.

import { CARNETS, CARNET_MARQUE, type Carnet } from '@memora/types';

/** Luminance relative, selon la formule des criteres d'accessibilite WCAG. */
export function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * Rapport de contraste entre deux couleurs opaques.
 *
 * Il ne sert plus a l'execution — les carnets portent leur propre couleur de
 * texte, ecrite et non devinee — mais il est ce qui verifie chaque carnet au
 * moment des tests. Une valeur mal choisie ne se voit pas a l'oeil : les
 * trois premieres corrigees etaient entre 4,05 et 4,47 pour un seuil a 4,5.
 */
export function contrastRatio(avant: string, arriere: string): number {
  const a = relativeLuminance(avant);
  const b = relativeLuminance(arriere);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Couleur de texte lisible sur un fond donne. */
export function readableTextOn(hex: string): '#FFFFFF' | '#131313' {
  return relativeLuminance(hex) > 0.45 ? '#131313' : '#FFFFFF';
}

/** Vrai si la chaine designe un carnet que l'application sait habiller. */
export function estUnCarnet(valeur: string | null | undefined): valeur is Carnet {
  return typeof valeur === 'string' && (CARNETS as readonly string[]).includes(valeur);
}

/**
 * Pose le carnet sur l'element racine.
 *
 * Un nom inconnu retombe sur le carnet de la marque plutot que de laisser la
 * page sans habillage : une soiree creee par une version plus recente du
 * serveur doit rester lisible sur un telephone qui n'a pas encore recharge.
 */
export function applyCarnet(carnet: string | null | undefined): Carnet {
  const choisi = estUnCarnet(carnet) ? carnet : CARNET_MARQUE;
  const root = document.documentElement;
  root.dataset.carnet = choisi;

  // La barre du navigateur suit : sur telephone, elle occupe une bande
  // visible en haut de l'ecran, et une barre claire au-dessus d'une page
  // noire se voit immediatement.
  const fond = getComputedStyle(root).getPropertyValue('--color-pap').trim();
  if (fond) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fond);
  }

  return choisi;
}
