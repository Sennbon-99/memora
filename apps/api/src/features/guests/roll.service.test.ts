// apps/api/src/features/guests/roll.service.test.ts
// Le tri par pellicule repose sur deux regles : les reservations abandonnees
// ne comptent pas, et le non-choix vaut conservation.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const rollFindMany = vi.fn();
const rollFindFirst = vi.fn();
const signRead = vi.fn(async (key: string) => `https://stockage/${key}?signature=abc`);
const rollUpdate = vi.fn();
const photoUpdateMany = vi.fn();
const transaction = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    roll: { findMany: rollFindMany, findFirst: rollFindFirst, update: rollUpdate },
    photo: { updateMany: photoUpdateMany },
    $transaction: transaction,
  },
}));
vi.mock('../../config/storage.js', () => ({ signRead }));
vi.mock('../events/event.service.js', () => ({
  assertCanManage: vi.fn().mockResolvedValue({ event: { id: 'e1' } }),
}));

const { listRolls, reviewRoll, listRollPhotos, nextUnreviewedRoll } =
  await import('./roll.service.js');

beforeEach(() => {
  rollFindMany.mockReset();
  rollFindFirst.mockReset();
  photoUpdateMany.mockReset();
  transaction.mockReset();
});

describe('listRolls', () => {
  it('ne compte pas les reservations jamais deposees', async () => {
    // Une pose reservee dont le transfert a echoue n'a pas de fichier :
    // la compter ferait croire a l'hote qu'il reste des photos a trier.
    rollFindMany.mockResolvedValue([{
      id: 'r1', firstName: 'Camille', reviewedAt: null,
      table: { label: 'Table 2' },
      photos: [
        { status: 'UPLOADED' }, { status: 'UPLOADED' },
        { status: 'HIDDEN' }, { status: 'RESERVED' },
      ],
      requests: [],
    }]);

    const [roll] = await listRolls('e1', 'u1');

    expect(roll!.photos).toBe(3);
    expect(roll!.hidden).toBe(1);
  });

  it('rend anonyme une pellicule sans prenom ni table', async () => {
    rollFindMany.mockResolvedValue([{
      id: 'r2', firstName: null, reviewedAt: null, table: null, photos: [], requests: [],
    }]);

    const [roll] = await listRolls('e1', 'u1');

    expect(roll!.firstName).toBeNull();
    expect(roll!.tableLabel).toBeNull();
    expect(roll!.photos).toBe(0);
  });

  it('signale une pellicule deja triee et une demande en attente', async () => {
    rollFindMany.mockResolvedValue([{
      id: 'r3', firstName: 'Marc', reviewedAt: new Date(),
      table: null, photos: [{ status: 'UPLOADED' }], requests: [{ id: 'q1' }],
    }]);

    const [roll] = await listRolls('e1', 'u1');

    expect(roll!.reviewed).toBe(true);
    expect(roll!.pendingRemoval).toBe(true);
  });
});

describe('reviewRoll', () => {
  it('remet tout en garde avant d appliquer les masquages', async () => {
    // L'ordre compte : sans la remise a UPLOADED, une photographie masquee
    // lors d'un premier passage resterait masquee apres correction.
    rollFindFirst.mockResolvedValue({ id: 'r1' });
    transaction.mockResolvedValue([{ count: 24 }, { count: 3 }, {}]);

    await reviewRoll('e1', 'r1', 'u1', ['p1', 'p2', 'p3']);

    const operations = transaction.mock.calls[0]![0] as unknown[];
    expect(operations).toHaveLength(3);
    expect(photoUpdateMany.mock.calls[0]![0]).toMatchObject({ data: { status: 'UPLOADED' } });
    expect(photoUpdateMany.mock.calls[1]![0]).toMatchObject({
      where: { rollId: 'r1', id: { in: ['p1', 'p2', 'p3'] } },
      data: { status: 'HIDDEN' },
    });
  });

  it('conserve tout quand l hote ne masque rien', async () => {
    rollFindFirst.mockResolvedValue({ id: 'r1' });
    transaction.mockResolvedValue([{ count: 24 }, { count: 0 }, {}]);

    const result = await reviewRoll('e1', 'r1', 'u1', []);

    expect(result).toEqual({ rollId: 'r1', hidden: 0 });
  });

  it('refuse une pellicule qui n appartient pas a l evenement', async () => {
    rollFindFirst.mockResolvedValue(null);

    expect(await reviewRoll('e1', 'intrus', 'u1', [])).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('listRollPhotos', () => {
  it('signe chaque adresse et n expose jamais la cle de stockage', async () => {
    rollFindFirst.mockResolvedValue({
      id: 'r1', firstName: 'Camille', reviewedAt: null, table: { label: 'Table 2' },
      photos: [
        { id: 'p1', objectKey: 'e1/r1/a.jpg', takenAt: new Date(), status: 'UPLOADED',
          width: 1536, height: 2048, moment: { label: 'Ouverture du bal' } },
      ],
    });

    const result = await listRollPhotos('e1', 'r1', 'u1');

    expect(result!.photos[0]).not.toHaveProperty('objectKey');
    expect(result!.photos[0]!.url).toContain('signature=');
    expect(result!.photos[0]!.momentLabel).toBe('Ouverture du bal');
    expect(result!.roll.tableLabel).toBe('Table 2');
  });

  it('ne demande que les photographies qui ont un fichier', async () => {
    rollFindFirst.mockResolvedValue({
      id: 'r1', firstName: null, reviewedAt: null, table: null, photos: [],
    });

    await listRollPhotos('e1', 'r1', 'u1');

    const where = rollFindFirst.mock.calls[0]![0].select.photos.where;
    expect(where).toEqual({ status: { in: ['UPLOADED', 'HIDDEN'] } });
  });

  it('rend null pour une pellicule d un autre evenement', async () => {
    rollFindFirst.mockResolvedValue(null);
    expect(await listRollPhotos('e1', 'intrus', 'u1')).toBeNull();
  });
});

describe('nextUnreviewedRoll', () => {
  it('ignore la pellicule qu on vient de trier et celles qui sont vides', async () => {
    rollFindFirst.mockResolvedValue({ id: 'r2' });

    expect(await nextUnreviewedRoll('e1', 'r1', 'u1')).toBe('r2');

    const where = rollFindFirst.mock.calls[0]![0].where;
    expect(where.id).toEqual({ not: 'r1' });
    expect(where.reviewedAt).toBeNull();
    // Proposer une pellicule sans photographie serait une impasse.
    expect(where.photos).toEqual({ some: { status: { in: ['UPLOADED', 'HIDDEN'] } } });
  });

  it('rend null quand tout est trie, ce qui declenche l ecran de fin', async () => {
    rollFindFirst.mockResolvedValue(null);
    expect(await nextUnreviewedRoll('e1', 'r1', 'u1')).toBeNull();
  });
});
