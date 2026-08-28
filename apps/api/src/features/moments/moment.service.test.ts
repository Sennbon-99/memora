// apps/api/src/features/moments/moment.service.test.ts

import { describe, expect, it, vi, beforeEach } from 'vitest';

const momentFindUnique = vi.fn();
const momentFindMany = vi.fn();
const momentUpdate = vi.fn();
const momentCreate = vi.fn();
const rollFindMany = vi.fn();
const eventFindUnique = vi.fn();
const grantBonusShots = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    moment: { findUnique: momentFindUnique, findMany: momentFindMany, update: momentUpdate, create: momentCreate },
    roll: { findMany: rollFindMany },
    event: { findUnique: eventFindUnique },
  },
}));
vi.mock('../../config/redis.js', () => ({ grantBonusShots }));

const { isActive, triggerMoment, closeMoment } = await import('./moment.service.js');

const openEvent = { id: 'e1', ownerId: 'u1', state: 'OPEN', coHosts: [] as unknown[] };
const moment = {
  id: 'm1', label: 'Ouverture du bal', eventId: 'e1',
  startedAt: null as Date | null, durationMinutes: 10, bonusShots: 3,
};

beforeEach(() => {
  [momentFindUnique, momentFindMany, momentUpdate, momentCreate, rollFindMany,
   eventFindUnique, grantBonusShots].forEach((m) => m.mockReset());
  eventFindUnique.mockResolvedValue(openEvent);
  momentFindMany.mockResolvedValue([]);
  rollFindMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);
});

describe('isActive', () => {
  it('est faux tant que le moment n a pas demarre', () => {
    expect(isActive({ startedAt: null, durationMinutes: 10 })).toBe(false);
  });

  it('est vrai pendant la fenetre', () => {
    expect(isActive({ startedAt: new Date(Date.now() - 60_000), durationMinutes: 10 })).toBe(true);
  });

  it('est faux une fois la fenetre expiree', () => {
    expect(isActive({ startedAt: new Date(Date.now() - 20 * 60_000), durationMinutes: 10 })).toBe(false);
  });
});

describe('triggerMoment', () => {
  it('credite les poses bonus a chaque pellicule, avec expiration', async () => {
    momentFindUnique.mockResolvedValue(moment);

    const result = await triggerMoment('m1', 'u1');

    expect(result.guestsNotified).toBe(3);
    expect(grantBonusShots).toHaveBeenCalledTimes(3);
    // Trois poses, valables exactement la duree du moment.
    expect(grantBonusShots).toHaveBeenCalledWith('r1', 3, 600);
  });

  it('calcule une heure de fin coherente avec la duree', async () => {
    momentFindUnique.mockResolvedValue(moment);

    const { startedAt, endsAt } = await triggerMoment('m1', 'u1');
    expect(endsAt.getTime() - startedAt.getTime()).toBe(10 * 60_000);
  });

  it('refuse de declencher deux fois le meme moment', async () => {
    momentFindUnique.mockResolvedValue({ ...moment, startedAt: new Date() });
    await expect(triggerMoment('m1', 'u1')).rejects.toMatchObject({ code: 'ALREADY_STARTED' });
  });

  it('refuse un moment qui chevaucherait un autre en cours', async () => {
    momentFindUnique.mockResolvedValue(moment);
    momentFindMany.mockResolvedValue([
      { startedAt: new Date(Date.now() - 120_000), durationMinutes: 10 },
    ]);

    await expect(triggerMoment('m1', 'u1')).rejects.toMatchObject({ code: 'MOMENT_OVERLAP' });
    expect(grantBonusShots).not.toHaveBeenCalled();
  });

  it('autorise un moment si le precedent est expire', async () => {
    momentFindUnique.mockResolvedValue(moment);
    momentFindMany.mockResolvedValue([
      { startedAt: new Date(Date.now() - 30 * 60_000), durationMinutes: 10 },
    ]);

    await expect(triggerMoment('m1', 'u1')).resolves.toBeTruthy();
  });

  it("refuse si l'evenement n'est pas ouvert", async () => {
    momentFindUnique.mockResolvedValue(moment);
    eventFindUnique.mockResolvedValue({ ...openEvent, state: 'CLOSED' });

    await expect(triggerMoment('m1', 'u1')).rejects.toMatchObject({ code: 'EVENT_NOT_OPEN' });
  });
});

describe('closeMoment', () => {
  it('retire les poses bonus de toutes les pellicules', async () => {
    momentFindUnique.mockResolvedValue({ ...moment, startedAt: new Date(Date.now() - 120_000) });

    await closeMoment('m1', 'u1');

    expect(grantBonusShots).toHaveBeenCalledTimes(3);
    // Credit ramene a zero : les poses non utilisees sont perdues.
    expect(grantBonusShots).toHaveBeenCalledWith('r1', 0, 1);
  });

  it('refuse de clore un moment qui n est pas en cours', async () => {
    momentFindUnique.mockResolvedValue(moment); // jamais demarre
    await expect(closeMoment('m1', 'u1')).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
  });
});
