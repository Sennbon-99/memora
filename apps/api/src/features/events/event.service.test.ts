// apps/api/src/features/events/event.service.test.ts
// Tests des regles metier de l'evenement. Prisma est remplace par un double :
// ces tests portent sur les regles, pas sur la base.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const findUniquePayment = vi.fn();
const count = vi.fn();
const create = vi.fn();
const update = vi.fn();
const eventFindMany = vi.fn();
const tableCreateMany = vi.fn();
const tableFindMany = vi.fn();
const rollFindMany = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    event: { findUnique, count, create, update, findMany: eventFindMany },
    payment: { findUnique: findUniquePayment },
    eventTable: { createMany: tableCreateMany, findMany: tableFindMany },
    roll: { findMany: rollFindMany },
  },
}));

const { assertCanManage, createEvent, updateEvent, openEvent, closeEvent, listEvents, getEvent, createTables } =
  await import('./event.service.js');

const baseEvent = {
  id: 'e1', ownerId: 'u1', state: 'DRAFT' as const, coHosts: [] as { userId: string }[],
};

beforeEach(() => {
  [findUnique, findUniquePayment, count, create, update,
   eventFindMany, tableCreateMany, tableFindMany].forEach((m) => m.mockReset());
});

describe('assertCanManage', () => {
  it("laisse passer l'hote", async () => {
    findUnique.mockResolvedValue(baseEvent);
    const { isOwner } = await assertCanManage('e1', 'u1');
    expect(isOwner).toBe(true);
  });

  it('laisse passer un co-hote, sans lui donner le statut de proprietaire', async () => {
    findUnique.mockResolvedValue({ ...baseEvent, ownerId: 'autre', coHosts: [{ userId: 'u1' }] });
    const { isOwner } = await assertCanManage('e1', 'u1');
    expect(isOwner).toBe(false);
  });

  it('refuse un utilisateur etranger a l evenement', async () => {
    findUnique.mockResolvedValue({ ...baseEvent, ownerId: 'autre' });
    await expect(assertCanManage('e1', 'u1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('createEvent', () => {
  it('respecte le quota choisi des le premier evenement', async () => {
    count.mockResolvedValue(0);
    create.mockImplementation(({ data }: { data: { quotaShots: number } }) => data);

    const event = await createEvent('u1', { quotaShots: 24, name: 'Mariage' } as never);
    expect(event.quotaShots).toBe(24);
  });

  it('respecte le quota demande a partir du deuxieme evenement', async () => {
    count.mockResolvedValue(1);
    create.mockImplementation(({ data }: { data: { quotaShots: number } }) => data);

    const event = await createEvent('u1', { quotaShots: 24, name: 'Mariage' } as never);
    expect(event.quotaShots).toBe(24);
  });
});

describe('updateEvent', () => {
  it('refuse de changer le quota une fois l evenement ouvert', async () => {
    findUnique.mockResolvedValue({ ...baseEvent, state: 'OPEN' });

    await expect(updateEvent('e1', 'u1', { quotaShots: 40 })).rejects.toMatchObject({
      code: 'EVENT_LOCKED',
    });
  });

  it('accepte de changer la couleur meme une fois ouvert', async () => {
    findUnique.mockResolvedValue({ ...baseEvent, state: 'OPEN' });
    update.mockResolvedValue({ id: 'e1', color: '#1FA97A' });

    await expect(updateEvent('e1', 'u1', { color: '#1FA97A' })).resolves.toMatchObject({
      color: '#1FA97A',
    });
  });
});

describe('openEvent', () => {
  it('ouvre un evenement sans consulter le paiement', async () => {
    findUnique.mockResolvedValue(baseEvent);
    count.mockResolvedValue(0);
    update.mockResolvedValue({ id: 'e1', state: 'OPEN' });

    await expect(openEvent('e1', 'u1')).resolves.toMatchObject({ state: 'OPEN' });
    // En V1, toutes les fonctions sont ouvertes et le paiement est reporte.
    expect(findUniquePayment).not.toHaveBeenCalled();
  });

  it('ouvre aussi le deuxieme evenement sans paiement', async () => {
    findUnique.mockResolvedValue(baseEvent);
    count.mockResolvedValue(1);
    findUniquePayment.mockResolvedValue(null);
    update.mockResolvedValue({ id: 'e1', state: 'OPEN' });

    await expect(openEvent('e1', 'u1')).resolves.toMatchObject({ state: 'OPEN' });
    expect(findUniquePayment).not.toHaveBeenCalled();
  });

  it('ignore un ancien paiement confirme devenu sans effet en V1', async () => {
    findUnique.mockResolvedValue(baseEvent);
    count.mockResolvedValue(1);
    findUniquePayment.mockResolvedValue({ state: 'PAID' });
    update.mockResolvedValue({ id: 'e1', state: 'OPEN' });

    await expect(openEvent('e1', 'u1')).resolves.toMatchObject({ state: 'OPEN' });
    expect(findUniquePayment).not.toHaveBeenCalled();
  });

  it("interdit a un co-hote d'ouvrir l'evenement", async () => {
    findUnique.mockResolvedValue({ ...baseEvent, ownerId: 'autre', coHosts: [{ userId: 'u1' }] });
    await expect(openEvent('e1', 'u1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('closeEvent', () => {
  it('refuse de fermer un evenement qui n a pas ete ouvert', async () => {
    findUnique.mockResolvedValue(baseEvent); // etat DRAFT
    await expect(closeEvent('e1', 'u1')).rejects.toMatchObject({ code: 'NOT_OPEN' });
  });
});

describe('listEvents', () => {
  it('inclut les evenements ou l utilisateur est co-hote', async () => {
    eventFindMany.mockResolvedValue([]);

    await listEvents('u1');

    const where = eventFindMany.mock.calls[0]![0].where;
    expect(where.OR).toEqual([
      { ownerId: 'u1' },
      { coHosts: { some: { userId: 'u1' } } },
    ]);
  });
});

describe('getEvent', () => {
  it('rend les tables utiles au kit sans exposer les secrets internes', async () => {
    findUnique.mockResolvedValue({
      ...baseEvent,
      name: 'Soiree', slug: 'soiree-123456', joinCode: 'ABC234', type: 'MARIAGE',
      eventDate: new Date(), quotaShots: 10, closesAt: new Date(), previewMode: 'NONE',
      carnet: 'papier', color: '#c9a961', welcomeMessage: null, useTableCodes: true,
      scope: 'NONE', accessCodeHash: 'secret', photographerToken: 'secret-2',
      tables: [{ id: 't1', label: 'Table 1' }],
    });

    const event = await getEvent('e1', 'u1');

    expect(event.tables).toEqual([{ id: 't1', label: 'Table 1' }]);
    expect(event).not.toHaveProperty('accessCodeHash');
    expect(event).not.toHaveProperty('photographerToken');
    expect(event).not.toHaveProperty('ownerId');
  });
});

describe('createTables', () => {
  it('cree une table par libelle, chacune avec son jeton', async () => {
    findUnique.mockResolvedValue(baseEvent);
    tableFindMany.mockResolvedValue([]);

    await createTables('e1', 'u1', ['Table 1', 'Table 2']);

    const data = tableCreateMany.mock.calls[0]![0].data;
    expect(data).toHaveLength(2);
    // Deux jetons distincts : connaitre l'un ne donne pas l'autre.
    expect(data[0].qrToken).not.toBe(data[1].qrToken);
  });

  it('refuse un nombre de tables superieur au plafond de participants', async () => {
    findUnique.mockResolvedValue(baseEvent);
    const trop = Array.from({ length: 201 }, (_, i) => `Table ${i}`);

    await expect(createTables('e1', 'u1', trop)).rejects.toMatchObject({ code: 'TOO_MANY_TABLES' });
  });
});

describe('listEvents, comptage des photographies', () => {
  beforeEach(() => {
    eventFindMany.mockReset();
    rollFindMany.mockReset();
  });

  it('additionne les photographies de toutes les pellicules d un evenement', async () => {
    // Une photographie appartient a une pellicule, pas a un evenement :
    // Prisma ne sait pas la compter depuis Event, d ou ce second passage.
    eventFindMany.mockResolvedValue([
      { id: 'e1', name: 'Mariage', _count: { rolls: 3 } },
      { id: 'e2', name: 'Anniversaire', _count: { rolls: 1 } },
    ]);
    rollFindMany.mockResolvedValue([
      { eventId: 'e1', _count: { photos: 24 } },
      { eventId: 'e1', _count: { photos: 11 } },
      { eventId: 'e1', _count: { photos: 7 } },
      { eventId: 'e2', _count: { photos: 5 } },
    ]);

    const events = await listEvents('u1');

    expect(events[0]!._count).toEqual({ rolls: 3, photos: 42 });
    expect(events[1]!._count).toEqual({ rolls: 1, photos: 5 });
  });

  it('renvoie zero pour un evenement sans aucune pellicule', async () => {
    // Le defaut d origine : le champ etait absent, et l ecran affichait
    // « 12 invites · photos » avec un trou a la place du nombre.
    eventFindMany.mockResolvedValue([{ id: 'e1', _count: { rolls: 0 } }]);
    rollFindMany.mockResolvedValue([]);

    const events = await listEvents('u1');

    expect(events[0]!._count.photos).toBe(0);
  });

  it('n interroge pas les pellicules quand il n y a aucun evenement', async () => {
    eventFindMany.mockResolvedValue([]);

    expect(await listEvents('u1')).toEqual([]);
    expect(rollFindMany).not.toHaveBeenCalled();
  });
});
