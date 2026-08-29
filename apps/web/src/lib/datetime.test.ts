// apps/web/src/lib/datetime.test.ts

import { describe, expect, it } from 'vitest';
import { defaultClosing, toDateInput, toDateTimeInput } from './datetime.js';

describe('toDateTimeInput', () => {
  it('rend l heure locale, pas l heure UTC', () => {
    // Le defaut d origine : toISOString() rendait 00:00 pour un 02:00 local
    // en heure d ete francaise. Ce test echoue si l on y revient.
    const local = new Date(2026, 7, 30, 2, 0, 0);
    expect(toDateTimeInput(local)).toBe('2026-08-30T02:00');
  });

  it('complete les nombres a un chiffre', () => {
    expect(toDateTimeInput(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});

describe('toDateInput', () => {
  it('ne decale pas le jour en fin de soiree', () => {
    // A 23 h a Paris, toISOString() bascule deja au lendemain en UTC :
    // l hote aurait vu la date du jour suivant proposee par defaut.
    expect(toDateInput(new Date(2026, 7, 29, 23, 30))).toBe('2026-08-29');
  });

  it('ne decale pas le jour au petit matin', () => {
    expect(toDateInput(new Date(2026, 7, 29, 0, 30))).toBe('2026-08-29');
  });
});

describe('defaultClosing', () => {
  it('propose deux heures du matin le lendemain', () => {
    const close = defaultClosing(new Date(2026, 7, 29, 18, 0));
    expect(toDateTimeInput(close)).toBe('2026-08-30T02:00');
  });

  it('passe correctement au mois suivant', () => {
    const close = defaultClosing(new Date(2026, 7, 31, 20, 0));
    expect(toDateTimeInput(close)).toBe('2026-09-01T02:00');
  });
});
