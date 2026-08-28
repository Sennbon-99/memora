// apps/api/src/features/jobs/jobs.test.ts
// Tests des taches planifiees : fermeture automatique et purge RGPD.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const eventFindMany = vi.fn();
const eventUpdateMany = vi.fn();
const eventUpdate = vi.fn();
const photoFindMany = vi.fn();
const rollDeleteMany = vi.fn();
const deleteObjects = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    event: { findMany: eventFindMany, updateMany: eventUpdateMany, update: eventUpdate },
    photo: { findMany: photoFindMany },
    roll: { deleteMany: rollDeleteMany },
  },
}));
vi.mock('../../config/storage.js', () => ({ deleteObjects }));

const { closeExpiredEvents } = await import('./closeEvents.job.js');
const { purgeExpiredEvents } = await import('./purge.job.js');

beforeEach(() => {
  [eventFindMany, eventUpdateMany, eventUpdate, photoFindMany, rollDeleteMany, deleteObjects]
    .forEach((m) => m.mockReset());
});

describe('closeExpiredEvents', () => {
  it('ferme les evenements dont l heure est passee', async () => {
    eventFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);

    const report = await closeExpiredEvents();

    expect(report.processed).toBe(2);
    // La condition state OPEN est repetee dans l'update : deux instances du
    // travailleur lancees ensemble ne peuvent pas fermer deux fois.
    expect(eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ state: 'OPEN' }) }),
    );
  });

  it('ne fait rien quand aucun evenement n est arrive a echeance', async () => {
    eventFindMany.mockResolvedValue([]);

    const report = await closeExpiredEvents();

    expect(report.processed).toBe(0);
    expect(eventUpdateMany).not.toHaveBeenCalled();
  });
});

describe('purgeExpiredEvents', () => {
  it('supprime les fichiers avant les enregistrements', async () => {
    const ordre: string[] = [];
    eventFindMany.mockResolvedValue([{ id: 'e1', name: 'Mariage' }]);
    photoFindMany.mockResolvedValue([{ objectKey: 'a.jpg' }, { objectKey: 'b.jpg' }]);
    deleteObjects.mockImplementation(async () => { ordre.push('fichiers'); });
    rollDeleteMany.mockImplementation(async () => { ordre.push('base'); });

    await purgeExpiredEvents();

    // Dans l'autre sens, un echec laisserait des fichiers orphelins
    // introuvables, puisque plus rien en base n'y renverrait.
    expect(ordre).toEqual(['fichiers', 'base']);
  });

  it('supprime par lots de cinq cents', async () => {
    eventFindMany.mockResolvedValue([{ id: 'e1', name: 'Mariage' }]);
    photoFindMany.mockResolvedValue(
      Array.from({ length: 1200 }, (_, i) => ({ objectKey: `photo-${i}.jpg` })),
    );

    await purgeExpiredEvents();

    // 1200 photographies : trois appels de 500, 500 et 200.
    expect(deleteObjects).toHaveBeenCalledTimes(3);
    expect(deleteObjects.mock.calls[0]![0]).toHaveLength(500);
    expect(deleteObjects.mock.calls[2]![0]).toHaveLength(200);
  });

  it('efface le jeton d album et le code d acces', async () => {
    eventFindMany.mockResolvedValue([{ id: 'e1', name: 'Mariage' }]);
    photoFindMany.mockResolvedValue([]);

    await purgeExpiredEvents();

    // Un lien de partage encore valide vers un album vide serait trompeur.
    expect(eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { state: 'PURGED', albumToken: null, accessCodeHash: null },
      }),
    );
  });

  it('ne touche pas aux evenements encore dans le delai de retention', async () => {
    eventFindMany.mockResolvedValue([]);

    const report = await purgeExpiredEvents();

    expect(report.processed).toBe(0);
    expect(deleteObjects).not.toHaveBeenCalled();
  });
});
