// apps/api/src/features/team/team.service.test.ts

import { describe, expect, it, vi, beforeEach } from 'vitest';

const eventFindUnique = vi.fn();
const eventUpdate = vi.fn();
const userFindUnique = vi.fn();
const coHostFindUnique = vi.fn();
const coHostCreate = vi.fn();
const coHostDeleteMany = vi.fn();
const coHostFindMany = vi.fn();
const rollFindFirst = vi.fn();
const rollCreate = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    event: { findUnique: eventFindUnique, update: eventUpdate },
    user: { findUnique: userFindUnique },
    coHost: {
      findUnique: coHostFindUnique, create: coHostCreate,
      deleteMany: coHostDeleteMany, findMany: coHostFindMany,
    },
    roll: { findFirst: rollFindFirst, create: rollCreate },
  },
}));

const { inviteCoHost, removeCoHost, createPhotographerLink, joinAsPhotographer } =
  await import('./team.service.js');

const event = {
  id: 'e1', ownerId: 'u1', state: 'OPEN', name: 'Mariage', color: '#B0741C',
  closesAt: new Date(), photographerToken: null as string | null, coHosts: [] as unknown[],
};

beforeEach(() => {
  [eventFindUnique, eventUpdate, userFindUnique, coHostFindUnique, coHostCreate,
   coHostDeleteMany, coHostFindMany, rollFindFirst, rollCreate].forEach((m) => m.mockReset());
  eventFindUnique.mockResolvedValue(event);
});

describe('inviteCoHost', () => {
  it('invite une personne qui possede deja un compte', async () => {
    userFindUnique.mockResolvedValue({ id: 'u2', name: 'Sonia', email: 'sonia@test.fr' });
    coHostFindUnique.mockResolvedValue(null);

    const result = await inviteCoHost('e1', 'u1', 'sonia@test.fr');

    expect(result.user.id).toBe('u2');
    expect(coHostCreate).toHaveBeenCalledWith({ data: { userId: 'u2', eventId: 'e1' } });
  });

  it("refuse d'inviter une personne sans compte plutot que d'en creer un", async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(inviteCoHost('e1', 'u1', 'inconnu@test.fr'))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it("refuse que l'hote s'invite lui-meme", async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', name: 'Lea', email: 'lea@test.fr' });

    await expect(inviteCoHost('e1', 'u1', 'lea@test.fr'))
      .rejects.toMatchObject({ code: 'ALREADY_OWNER' });
  });

  it('refuse une invitation en double', async () => {
    userFindUnique.mockResolvedValue({ id: 'u2', name: 'Sonia', email: 'sonia@test.fr' });
    coHostFindUnique.mockResolvedValue({ userId: 'u2', eventId: 'e1' });

    await expect(inviteCoHost('e1', 'u1', 'sonia@test.fr'))
      .rejects.toMatchObject({ code: 'ALREADY_CO_HOST' });
  });

  it("interdit a un co-hote d'en inviter un autre", async () => {
    eventFindUnique.mockResolvedValue({ ...event, ownerId: 'autre', coHosts: [{ userId: 'u1' }] });

    await expect(inviteCoHost('e1', 'u1', 'x@test.fr'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('removeCoHost', () => {
  it('retire un co-hote existant', async () => {
    coHostDeleteMany.mockResolvedValue({ count: 1 });
    await expect(removeCoHost('e1', 'u1', 'u2')).resolves.toMatchObject({ removed: true });
  });

  it('renvoie une erreur si la personne n etait pas co-hote', async () => {
    coHostDeleteMany.mockResolvedValue({ count: 0 });
    await expect(removeCoHost('e1', 'u1', 'u9')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('createPhotographerLink', () => {
  it('produit un jeton et le conserve', async () => {
    const { token } = await createPhotographerLink('e1', 'u1');

    expect(token).toBeTruthy();
    expect(eventUpdate).toHaveBeenCalled();
  });

  it('reutilise le jeton existant plutot que d en creer un second', async () => {
    eventFindUnique.mockResolvedValue({ ...event, photographerToken: 'deja-la' });

    const { token } = await createPhotographerLink('e1', 'u1');

    // Regenerer casserait le lien deja transmis au photographe.
    expect(token).toBe('deja-la');
    expect(eventUpdate).not.toHaveBeenCalled();
  });
});

describe('joinAsPhotographer', () => {
  it('ouvre une pellicule au quota nominal, consentement acquis', async () => {
    rollCreate.mockResolvedValue({ id: 'r-photo', shotsLeft: 2000 });

    const session = await joinAsPhotographer('token-photo');

    expect(session.roll.shotsLeft).toBe(2000);
    expect(session.roll.isPhotographer).toBe(true);
    // Le photographe est mandate par l'hote, pas convive : pas d'ecran
    // de consentement a lui imposer.
    expect(rollCreate.mock.calls[0]![0].data.consentedAt).toBeInstanceOf(Date);
  });

  it('refuse un jeton inconnu', async () => {
    eventFindUnique.mockResolvedValue(null);
    await expect(joinAsPhotographer('faux')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuse si l evenement est ferme', async () => {
    eventFindUnique.mockResolvedValue({ ...event, state: 'CLOSED' });
    await expect(joinAsPhotographer('token-photo')).rejects.toMatchObject({ code: 'EVENT_CLOSED' });
  });
});
