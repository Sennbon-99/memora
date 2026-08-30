// packages/types/src/locale.test.ts
import { describe, expect, it } from 'vitest';
import { loginSchema, createEventSchema } from './index.js';

describe('messages de validation', () => {
  it('rend une adresse invalide en francais', () => {
    const r = loginSchema.safeParse({ email: 'pas-une-adresse', password: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).toBe('Adresse électronique invalide');
  });

  it('rend un champ manquant en francais', () => {
    const r = loginSchema.safeParse({ password: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).toBe('Ce champ est obligatoire');
  });

  it('rend une longueur insuffisante en francais', () => {
    const r = createEventSchema.safeParse({ name: 'ab' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const nom = r.error.issues.find((i) => i.path[0] === 'name');
      expect(nom!.message).toBe('Trois caractères au moins');
    }
  });

  it("ne laisse passer aucun message anglais sur un objet entierement invalide", () => {
    // Les limites de mot sont indispensables : sans elles, /invalid/i
    // matcherait « Date invalide », qui est pourtant du francais.
    const ANGLAIS = /\b(must|contain|invalid|required|expected|received|string|number)\b/i;
    const r = createEventSchema.safeParse({ name: '', quotaShots: 999, color: 'rouge' });

    expect(r.success).toBe(false);
    if (!r.success) {
      const fautifs = r.error.issues.filter((i) => ANGLAIS.test(i.message));
      expect(fautifs.map((i) => `${String(i.path[0])}: ${i.message}`)).toEqual([]);
    }
  });
});
