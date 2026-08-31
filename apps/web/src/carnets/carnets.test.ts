// apps/web/src/carnets/carnets.test.ts
// Le contraste de chaque carnet, verifie plutot qu'affirme.
//
// Un carnet est un fichier de valeurs que n'importe qui peut ajouter en une
// demi-journee. Sans ce test, la premiere couleur mal choisie ne se verrait
// qu'en soiree, sur le telephone d'un invite, dans une salle sombre — c'est
// a dire jamais du point de vue de l'equipe.
//
// Les trois echecs qu'il a attrapes a l'ecriture etaient tous sur l'encre
// tertiaire, entre 4,05 et 4,47 pour un seuil a 4,5. Aucun ne se voyait a
// l'oeil.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../lib/theme.js';

/** Teinte en degres, pour verifier qu'un signal reste ce qu'il annonce. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const t = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (t * 60 + 360) % 360;
}

const ICI = dirname(fileURLToPath(import.meta.url));

/**
 * Les jetons opaques d'un carnet.
 *
 * Les valeurs translucides — les filets, notamment — sont ignorees : leur
 * contraste depend de ce qu'il y a dessous, et aucune ne porte de texte.
 */
function jetons(fichier: string): Record<string, string> {
  const css = readFileSync(join(ICI, fichier), 'utf8');
  const trouve: Record<string, string> = {};
  for (const [, nom, valeur] of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) {
    if (nom && valeur) trouve[nom] = valeur;
  }
  return trouve;
}

/** Les paires que le produit pose vraiment a l'ecran, et leur seuil. */
const PAIRES: [avant: string, arriere: string, quoi: string, seuil: number][] = [
  ['ink', 'pap', 'texte principal sur la page', 4.5],
  ['ink-2', 'pap', 'texte secondaire sur la page', 4.5],
  ['ink-3', 'pap', 'texte tertiaire sur la page', 4.5],
  ['ink', 'pap-2', 'texte principal sur une surface', 4.5],
  ['ink-2', 'pap-2', 'texte secondaire sur une surface', 4.5],
  ['ink-3', 'pap-2', 'texte tertiaire sur une surface', 4.5],
  ['ink-tirage', 'tirage', 'legende sur un tirage', 4.5],
  ['on-a1', 'a1', 'texte sur le premier accent', 4.5],
  ['on-a2', 'a2', 'texte sur le deuxieme accent', 4.5],
  ['on-a3', 'a3', 'texte sur le troisieme accent', 4.5],
  ['ink-well', 'well', 'texte dans le puits', 4.5],
  ['ink-well-2', 'well', 'texte en retrait dans le puits', 4.5],
  // Le compteur de poses est l'element le plus regarde de l'application, et
  // il vit dans le puits : son chiffre doit y tenir le contraste.
  ['a-well', 'well', 'le compteur dans le puits', 4.5],
  ['danger', 'pap', "l'alerte sur la page", 4.5],
  ['ok', 'pap', 'la confirmation sur la page', 4.5],
  ['warn', 'pap', "l'avertissement sur la page", 4.5],
  ['on-danger', 'danger', "texte sur l'alerte pleine", 4.5],
  // Un accent ne porte jamais de texte courant : il porte des chiffres, des
  // filets et des titres. Le seuil des grands caracteres suffit.
  ['a1', 'pap', 'accent sur la page', 3],
];

const CARNETS = readdirSync(ICI).filter((f) => f.endsWith('.css'));

describe('les carnets', () => {
  it('sont au moins trois', () => {
    expect(CARNETS.length).toBeGreaterThanOrEqual(3);
  });

  describe.each(CARNETS)('%s', (fichier) => {
    const trouve = jetons(fichier);

    it.each(PAIRES)('%s sur %s — %s', (avant, arriere, _quoi, seuil) => {
      const a = trouve[avant];
      const b = trouve[arriere];
      expect(a, `le jeton --color-${avant} manque`).toBeDefined();
      expect(b, `le jeton --color-${arriere} manque`).toBeDefined();
      expect(contrastRatio(a as string, b as string)).toBeGreaterThanOrEqual(seuil);
    });

    // Un carnet choisit sa nuance de rouge, jamais autre chose que du rouge :
    // sans cette borne, un carnet pourrait faire d'un retrait de photo un
    // bouton vert, et l'irreversible changerait de sens selon le gout de
    // l'hote. La teinte est bornee autour du rouge, aux deux extremites du
    // cercle chromatique.
    it("garde une alerte rouge", () => {
      const danger = trouve['danger'];
      expect(danger, 'le jeton --color-danger manque').toBeDefined();
      const teinte = hue(danger as string);
      expect(teinte >= 340 || teinte <= 25, `teinte ${teinte.toFixed(0)}deg`).toBe(true);
    });
  });
});
