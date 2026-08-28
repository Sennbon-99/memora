// 🧪 apps/api/src/features/auth/auth.service.test.ts
// Tests du service d'authentification. Prisma est remplace par un double,
// pour que ces tests portent sur la regle metier et non sur la base.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const create = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: { user: { findUnique, create } },
}));

const { register, login } = await import('./auth.service.js');
const { hashPassword } = await import('../../utils/hash.js');

beforeEach(() => {
  findUnique.mockReset();
  create.mockReset();
});

describe('register', () => {
  it('cree le compte et renvoie les deux jetons', async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'u1', email: 'lea@test.fr', name: 'Lea', role: 'HOST' });

    const result = await register({ email: 'lea@test.fr', password: 'motdepasse123', name: 'Lea' });

    expect(result.user.id).toBe('u1');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    // Le mot de passe ne doit jamais ressortir du service.
    expect(JSON.stringify(result)).not.toContain('motdepasse123');
  });

  it("refuse une adresse deja inscrite sans reveler qu'elle existe", async () => {
    findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      register({ email: 'lea@test.fr', password: 'motdepasse123', name: 'Lea' }),
    ).rejects.toMatchObject({ code: 'REGISTRATION_FAILED' });
  });
});

describe('login', () => {
  it('accepte des identifiants valides', async () => {
    findUnique.mockResolvedValue({
      id: 'u1', email: 'lea@test.fr', name: 'Lea', role: 'HOST',
      passwordHash: await hashPassword('motdepasse123'),
    });

    const result = await login({ email: 'lea@test.fr', password: 'motdepasse123' });
    expect(result.user.email).toBe('lea@test.fr');
  });

  it('renvoie la meme erreur que le compte existe ou non', async () => {
    // Compte inexistant
    findUnique.mockResolvedValue(null);
    const inconnu = await login({ email: 'x@test.fr', password: 'quelconque123' }).catch((e) => e);

    // Compte existant, mauvais mot de passe
    findUnique.mockResolvedValue({
      id: 'u1', email: 'lea@test.fr', name: 'Lea', role: 'HOST',
      passwordHash: await hashPassword('leVraiMotDePasse'),
    });
    const mauvais = await login({ email: 'lea@test.fr', password: 'mauvais123456' }).catch((e) => e);

    // C'est le point du test : les deux reponses sont indiscernables.
    expect(inconnu.code).toBe(mauvais.code);
    expect(inconnu.message).toBe(mauvais.message);
  });
});
