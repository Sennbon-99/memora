// apps/web/src/lib/image.test.ts

import { describe, expect, it } from 'vitest';
import { cropBox, scaledSize } from './image.js';

describe('scaledSize', () => {
  it('ne modifie pas une image deja assez petite', () => {
    expect(scaledSize(1200, 900)).toEqual({ width: 1200, height: 900 });
  });

  it('ramene le cote le plus long a la borne, en paysage', () => {
    expect(scaledSize(4032, 3024)).toEqual({ width: 2048, height: 1536 });
  });

  it('ramene le cote le plus long a la borne, en portrait', () => {
    // Cas le plus frequent : un telephone tenu verticalement.
    expect(scaledSize(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });

  it('conserve les proportions a un pixel pres', () => {
    const { width, height } = scaledSize(4000, 2250);
    expect(width / height).toBeCloseTo(4000 / 2250, 2);
  });
});

describe('cropBox', () => {
  it('ne touche pas a une image deja au bon rapport', () => {
    // La tolerance existe pour ce cas : un flux rendu 1:1 par le navigateur
    // ne doit pas etre rogne d'un pixel a chaque pose.
    expect(cropBox(2048, 2048, 1)).toEqual({ x: 0, y: 0, width: 2048, height: 2048 });
  });

  it('rogne les cotes d une image trop large, en restant centre', () => {
    // Un capteur 4:3 en paysage, ramene au carre : 504 pixels de chaque bord.
    expect(cropBox(4032, 3024, 1)).toEqual({ x: 504, y: 0, width: 3024, height: 3024 });
  });

  it('rogne le haut et le bas d une image trop haute', () => {
    expect(cropBox(3024, 4032, 1)).toEqual({ x: 0, y: 504, width: 3024, height: 3024 });
  });

  it('atteint le rapport demande pour un plein ecran de telephone', () => {
    const ecran = 1170 / 2532;
    const { width, height } = cropBox(3024, 4032, ecran);
    expect(width / height).toBeCloseTo(ecran, 3);
  });

  it('ne sort jamais de l image d origine', () => {
    const source = { width: 4032, height: 3024 };
    const { x, y, width, height } = cropBox(source.width, source.height, 9 / 16);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + width).toBeLessThanOrEqual(source.width);
    expect(y + height).toBeLessThanOrEqual(source.height);
  });
});
