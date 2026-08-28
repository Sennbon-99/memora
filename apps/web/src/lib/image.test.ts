// apps/web/src/lib/image.test.ts

import { describe, expect, it } from 'vitest';
import { scaledSize } from './image.js';

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
