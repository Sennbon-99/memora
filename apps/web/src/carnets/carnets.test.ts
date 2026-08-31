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

    // Un carnet qui redefinirait un signal donnerait une interface ou
    // l'irreversible change de couleur selon le gout de l'hote.
    it.each(['ok', 'warn', 'danger', 'on-danger'])(
      'ne redefinit pas le signal %s',
      (signal) => {
        expect(trouve[signal]).toBeUndefined();
      },
    );
  });
});
