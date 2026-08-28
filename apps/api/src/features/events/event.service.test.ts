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

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    event: { findUnique, count, create, update, findMany: eventFindMany },
    payment: { findUnique: findUniquePayment },
    eventTable: { createMany: tableCreateMany, findMany: tableFindMany },
  },
}));

const { assertCanManage, createEvent, updateEvent, openEvent, closeEvent, listEvents, createTables } =
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
  it('bride le premier evenement aux dix poses de l offre gratuite', async () => {
    count.mockResolvedValue(0);
    create.mockImplementation(({ data }: { data: { quotaShots: number } }) => data);

    const event = await createEvent('u1', { quotaShots: 24, name: 'Mariage' } as never);
    expect(event.quotaShots).toBe(10);
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
  it('ouvre gratuitement le premier evenement', async () => {
    findUnique.mockResolvedValue(baseEvent);
    count.mockResolvedValue(0);
    update.mockResolvedValue({ id: 'e1', state: 'OPEN' });

    await expect(openEvent('e1', 'u1')).resolves.toMatchObject({ state: 'OPEN' });
    // Aucun paiement n'a ete recherche : l'offre gratuite suffit.
    expect(findUniquePayment).not.toHaveBeenCalled();
  });

  it('exige un paiement pour le deuxieme evenement', async () => {
    findUnique.mockResolvedValue(baseEvent);
    count.mockResolvedValue(1);
    findUniquePayment.mockResolvedValue(null);

    await expect(openEvent('e1', 'u1')).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
  });

  it('ouvre le deuxieme evenement une fois le paiement confirme', async () => {
    findUnique.mockResolvedValue(baseEvent);
    count.mockResolvedValue(1);
    findUniquePayment.mockResolvedValue({ state: 'PAID' });
    update.mockResolvedValue({ id: 'e1', state: 'OPEN' });

    await expect(openEvent('e1', 'u1')).resolves.toMatchObject({ state: 'OPEN' });
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
