// apps/web/src/features/host/useMoments.test.ts
// Le decompte est la seule logique de l'ecran des moments, et c'est celle
// que l'hote regarde en pleine soiree.

import { describe, expect, it } from 'vitest';
import { formatCountdown, secondsLeft } from './useMoments.js';

const moment = (startedAt: string | null, durationMinutes = 10) => ({
  id: 'm1', label: 'Ouverture du bal', plannedAt: null, startedAt,
  durationMinutes, bonusShots: 5, active: startedAt !== null, photoCount: 0,
});

describe('secondsLeft', () => {
  it('rend le temps restant d une fenetre en cours', () => {
    const debut = new Date('2026-08-29T22:00:00Z');
    const maintenant = new Date('2026-08-29T22:03:20Z').getTime();

    expect(secondsLeft(moment(debut.toISOString()), maintenant)).toBe(400);
  });

  it('rend null pour un moment jamais declenche', () => {
    expect(secondsLeft(moment(null))).toBeNull();
  });

  it('rend null pour une fenetre expiree, plutot qu un nombre negatif', () => {
    // Sans cela l'ecran afficherait « encore -3 min », et l'hote croirait
    // a un defaut alors que le moment est simplement termine.
    const debut = new Date('2026-08-29T22:00:00Z');
    const maintenant = new Date('2026-08-29T22:13:00Z').getTime();

    expect(secondsLeft(moment(debut.toISOString()), maintenant)).toBeNull();
  });

  it('tient compte de la duree propre a chaque moment', () => {
    const debut = new Date('2026-08-29T22:00:00Z');
    const maintenant = new Date('2026-08-29T22:01:00Z').getTime();

    expect(secondsLeft(moment(debut.toISOString(), 2), maintenant)).toBe(60);
    expect(secondsLeft(moment(debut.toISOString(), 1), maintenant)).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('dit les minutes et les secondes', () => {
    expect(formatCountdown(440)).toBe('7 min 20');
  });

  it('complete les secondes a un chiffre', () => {
    expect(formatCountdown(305)).toBe('5 min 05');
  });

  it('passe aux secondes seules sous une minute', () => {
    expect(formatCountdown(42)).toBe('42 s');
  });
});
