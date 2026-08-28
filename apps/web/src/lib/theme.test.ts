// apps/web/src/lib/theme.test.ts

import { describe, expect, it } from 'vitest';
import { readableTextOn, relativeLuminance } from './theme.js';

describe('readableTextOn', () => {
  it('choisit du texte sombre sur une couleur claire', () => {
    expect(readableTextOn('#F5C518')).toBe('#131313'); // jaune vif
    expect(readableTextOn('#FFFFFF')).toBe('#131313');
  });

  it('choisit du texte clair sur une couleur sombre', () => {
    expect(readableTextOn('#B0741C')).toBe('#FFFFFF'); // ambre Memora
    expect(readableTextOn('#2F6BE0')).toBe('#FFFFFF'); // bleu
    expect(readableTextOn('#131313')).toBe('#FFFFFF');
  });

  it('traite correctement les cinq couleurs proposees a l hote', () => {
    // Aucune ne doit produire un texte illisible : c'est le seul garde-fou
    // automatique contre un choix de couleur malheureux.
    for (const couleur of ['#B0741C', '#7B3FE4', '#1FA97A', '#E0533D', '#2F6BE0']) {
      expect(['#FFFFFF', '#131313']).toContain(readableTextOn(couleur));
    }
  });
});

describe('relativeLuminance', () => {
  it('donne zero pour le noir et un pour le blanc', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 3);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 3);
  });

  it('classe les couleurs de la plus sombre a la plus claire', () => {
    const bleu = relativeLuminance('#2F6BE0');
    const ambre = relativeLuminance('#B0741C');
    const jaune = relativeLuminance('#F5C518');

    expect(bleu).toBeLessThan(jaune);
    expect(ambre).toBeLessThan(jaune);
  });
});
