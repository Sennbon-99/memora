// apps/web/src/lib/echelle.test.ts
// L'echelle typographique, tenue plutot qu'affirmee.
//
// Le produit portait cent trente-quatre tailles ecrites a la main, en
// `text-[Npx]`, pour seize valeurs distinctes — dont des doublons a un demi
// pixel (9 et 9,5 ; 12 et 12,5) et six valeurs employees une seule fois. Rien
// ne les empechait de se multiplier : chaque ecran choisissait la sienne, et
// personne ne relisait les autres.
//
// Ce test ne juge pas du gout. Il verifie deux choses mecaniques : qu'aucune
// taille arbitraire ne revient, et que chaque palier declare sert vraiment.
// Un palier que plus rien n'emploie est une decision oubliee, pas une echelle.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Tous les composants du client, chemin relatif a src/. */
function composants(dossier = SRC, prefixe = ''): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    if (entree.isDirectory()) return composants(join(dossier, entree.name), chemin);
    return /\.tsx$/.test(entree.name) && !entree.name.includes('.test.') ? [chemin] : [];
  });
}

const SOURCES = composants().map((f) => [f, readFileSync(join(SRC, f), 'utf8')] as const);

/** Les paliers declares dans le bloc @theme de styles.css. */
const PALIERS = [...readFileSync(join(SRC, 'styles.css'), 'utf8')
  .matchAll(/--text-([a-z-]+):\s*(\d+)px/g)]
  .map(([, nom, px]) => [nom as string, Number(px)] as const);

describe('l’échelle typographique', () => {
  it('compte au moins dix paliers, tous distincts', () => {
    expect(PALIERS.length).toBeGreaterThanOrEqual(10);
    const tailles = PALIERS.map(([, px]) => px);
    expect(new Set(tailles).size, 'deux paliers portent la meme taille').toBe(tailles.length);
  });

  // Le verrou principal. Une taille ecrite a la main echappe a l'echelle et ne
  // se voit dans aucune revue : elle ne casse rien, elle derive.
  it('aucun composant n’écrit de taille en dur', () => {
    const fautifs = SOURCES
      .filter(([, contenu]) => /text-\[[0-9.]+(px|rem|em)\]/.test(contenu))
      .map(([f, contenu]) => {
        const trouve = [...contenu.matchAll(/text-\[[0-9.]+(?:px|rem|em)\]/g)].map((m) => m[0]);
        return `${f} → ${[...new Set(trouve)].join(', ')}`;
      });
    expect(fautifs, 'employez un palier de l’échelle, ou ajoutez-en un').toEqual([]);
  });

  // Un palier sans appelant est du vocabulaire mort : il donne l'illusion d'un
  // systeme plus riche qu'il n'est, et le prochain a choisir hesitera entre
  // deux noms dont un seul a jamais servi.
  it.each(PALIERS)('le palier %s (%ipx) est employé', (nom) => {
    const emplois = SOURCES.filter(([, contenu]) =>
      new RegExp(`\\btext-${nom}\\b`).test(contenu)).length;
    expect(emplois, `--text-${nom} n’est employé nulle part`).toBeGreaterThan(0);
  });
});
