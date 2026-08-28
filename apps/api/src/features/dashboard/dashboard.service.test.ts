// apps/api/src/features/dashboard/dashboard.service.test.ts

import { describe, expect, it, vi, beforeEach } from 'vitest';

const eventFindUnique = vi.fn();
const rollFindMany = vi.fn();
const photoCount = vi.fn();
const tableFindMany = vi.fn();
const momentFindMany = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    event: { findUnique: eventFindUnique },
    roll: { findMany: rollFindMany },
    photo: { count: photoCount },
    eventTable: { findMany: tableFindMany },
    moment: { findMany: momentFindMany },
  },
}));

const { getStats } = await import('./dashboard.service.js');

const event = {
  id: 'e1', ownerId: 'u1', state: 'OPEN', quotaShots: 24,
  closesAt: new Date(Date.now() + 2 * 3_600_000), coHosts: [] as unknown[],
};

beforeEach(() => {
  [eventFindUnique, rollFindMany, photoCount, tableFindMany, momentFindMany]
    .forEach((m) => m.mockReset());
  eventFindUnique.mockResolvedValue(event);
  tableFindMany.mockResolvedValue([]);
  momentFindMany.mockResolvedValue([]);
  photoCount.mockResolvedValue(0);
});

describe('getStats', () => {
  it('exclut le photographe du compte des invites', async () => {
    rollFindMany.mockResolvedValue([
      { id: 'r1', shotsLeft: 20, tableId: null, isPhotographer: false },
      { id: 'r2', shotsLeft: 18, tableId: null, isPhotographer: false },
      { id: 'r3', shotsLeft: 1800, tableId: null, isPhotographer: true },
    ]);

    const stats = await getStats('e1', 'u1');

    // Ses centaines de photographies ecraseraient toutes les colonnes.
    expect(stats.activeGuests).toBe(2);
  });

  it('calcule le taux de consommation sur les seuls invites', async () => {
    rollFindMany.mockResolvedValue([
      { id: 'r1', shotsLeft: 12, tableId: null, isPhotographer: false },
      { id: 'r2', shotsLeft: 12, tableId: null, isPhotographer: false },
    ]);

    const stats = await getStats('e1', 'u1');

    // 48 poses au total, 24 restantes : la moitie consommee.
    expect(stats.quotaUsedPercent).toBe(50);
  });

  it('renvoie zero pour cent quand personne n a encore rejoint', async () => {
    rollFindMany.mockResolvedValue([]);

    const stats = await getStats('e1', 'u1');

    // Une division par zero donnerait NaN et casserait l'affichage.
    expect(stats.quotaUsedPercent).toBe(0);
    expect(stats.activeGuests).toBe(0);
  });

  it('classe les tables par nombre de photographies', async () => {
    rollFindMany.mockResolvedValue([]);
    tableFindMany.mockResolvedValue([
      { id: 't1', label: 'Table 1', _count: { rolls: 8 } },
      { id: 't2', label: 'Table 2', _count: { rolls: 6 } },
    ]);
    photoCount.mockResolvedValueOnce(0).mockResolvedValueOnce(40).mockResolvedValueOnce(150);

    const stats = await getStats('e1', 'u1');

    expect(stats.byTable[0]!.photos).toBeGreaterThanOrEqual(stats.byTable[1]!.photos);
  });

  it('indique le temps restant avant fermeture, et rien une fois ferme', async () => {
    rollFindMany.mockResolvedValue([]);

    const ouvert = await getStats('e1', 'u1');
    expect(ouvert.closesInMinutes).toBeGreaterThan(100);

    eventFindUnique.mockResolvedValue({ ...event, state: 'CLOSED' });
    const ferme = await getStats('e1', 'u1');
    expect(ferme.closesInMinutes).toBeNull();
  });

  it('distingue les moments en cours de ceux qui sont passes', async () => {
    rollFindMany.mockResolvedValue([]);
    momentFindMany.mockResolvedValue([
      { label: 'Cocktail', startedAt: new Date(Date.now() - 30 * 60_000), durationMinutes: 10, _count: { photos: 218 } },
      { label: 'Bal', startedAt: new Date(Date.now() - 60_000), durationMinutes: 10, _count: { photos: 61 } },
      { label: 'Gateau', startedAt: null, durationMinutes: 10, _count: { photos: 0 } },
    ]);

    const stats = await getStats('e1', 'u1');

    expect(stats.topMoments[0]!.active).toBe(false); // termine
    expect(stats.topMoments[1]!.active).toBe(true);  // en cours
    expect(stats.topMoments[2]!.active).toBe(false); // pas declenche
  });
});
