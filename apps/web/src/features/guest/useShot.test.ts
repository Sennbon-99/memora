// apps/web/src/features/guest/useShot.test.ts
// Le decompte local hors ligne est la seule regle metier du client.
// Elle est testee comme telle, sans passer par React.

import { describe, expect, it } from 'vitest';
import { spendLocally } from './useShot.js';

describe('spendLocally', () => {
  it('entame les poses offertes avant le quota principal', () => {
    // Meme ordre que le script Lua du serveur : sans cela, les deux
    // decomptes divergeraient au retour du reseau.
    expect(spendLocally({ shotsLeft: 20, bonusShots: 3 })).toEqual({
      shotsLeft: 20,
      bonusShots: 2,
    });
  });

  it('entame le quota principal une fois les poses offertes epuisees', () => {
    expect(spendLocally({ shotsLeft: 20, bonusShots: 0 })).toEqual({
      shotsLeft: 19,
      bonusShots: 0,
    });
  });

  it('ne descend jamais sous zero', () => {
    expect(spendLocally({ shotsLeft: 0, bonusShots: 0 })).toEqual({
      shotsLeft: 0,
      bonusShots: 0,
    });
  });
});
