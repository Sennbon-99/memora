// apps/api/src/features/photos/photo.service.test.ts
// Tests du trajet d'une photographie. Ce sont les tests les plus importants
// du projet : ils portent sur les quatre garanties annoncees dans le dossier
// (idempotence, atomicite, absence de doublon, restitution de pose).

import { describe, expect, it, vi, beforeEach } from 'vitest';

const photoFindUnique = vi.fn();
const photoCreate = vi.fn();
const photoUpdate = vi.fn();
const eventFindUnique = vi.fn();
const rollUpdate = vi.fn();
const momentFindMany = vi.fn();
const transaction = vi.fn();
const consumeShot = vi.fn();
const refundShot = vi.fn();
const signUpload = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    photo: { findUnique: photoFindUnique, create: photoCreate, update: photoUpdate, findMany: vi.fn() },
    event: { findUnique: eventFindUnique },
    roll: { update: rollUpdate },
    moment: { findMany: momentFindMany },
    removalRequest: { create: vi.fn() },
    $transaction: transaction,
  },
}));
vi.mock('../../config/redis.js', () => ({ consumeShot, refundShot }));
vi.mock('../../config/storage.js', () => ({
  buildObjectKey: (e: string, r: string, u: string) => `${e}/${r}/${u}.jpg`,
  signUpload,
  signRead: vi.fn(),
}));

const { reserveShot, confirmUpload, acceptsPhotos } = await import('./photo.service.js');

const roll = {
  id: 'r1', eventId: 'e1', consentedAt: new Date(), shotsLeft: 24, bonusShots: 0, tableId: null,
};
const KEY = '11111111-1111-4111-8111-111111111111';
const input = {
  idempotencyKey: KEY, takenAt: new Date(), width: 3024, height: 4032, sizeBytes: 2_800_000,
};

beforeEach(() => {
  [photoFindUnique, photoCreate, photoUpdate, eventFindUnique, rollUpdate,
   momentFindMany, transaction, consumeShot, refundShot, signUpload].forEach((m) => m.mockReset());

  eventFindUnique.mockResolvedValue({ id: 'e1', state: 'OPEN', closesAt: new Date(Date.now() + 3_600_000) });
  momentFindMany.mockResolvedValue([]);
  signUpload.mockResolvedValue('https://minio.local/upload-signe');
  // Par defaut, la transaction execute la fonction qu'on lui passe.
  transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({ roll: { update: rollUpdate }, photo: { create: photoCreate } }),
  );
});

describe('reserveShot', () => {
  it('reserve une pose et delivre une adresse d envoi signee', async () => {
    photoFindUnique.mockResolvedValue(null);
    consumeShot.mockResolvedValue({ remaining: 23, fromBonus: false });
    photoCreate.mockResolvedValue({ id: 'p1' });

    const res = await reserveShot(roll, input);

    expect(res.shotsLeft).toBe(23);
    expect(res.uploadUrl).toContain('upload-signe');
    // Le compteur persistant suit le compteur Redis dans la meme transaction.
    expect(rollUpdate).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { shotsLeft: 23 } });
  });

  it('ne consomme qu une seule pose lorsque la requete est rejouee', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', objectKey: 'e1/r1/x.jpg', rollId: 'r1' });

    const res = await reserveShot(roll, input);

    expect(res.photoId).toBe('p1');
    // Le point du test : aucun decrement, aucune creation.
    expect(consumeShot).not.toHaveBeenCalled();
    expect(photoCreate).not.toHaveBeenCalled();
  });

  it('refuse une cle d idempotence appartenant a une autre pellicule', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', objectKey: 'k', rollId: 'AUTRE' });

    await expect(reserveShot(roll, input)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('refuse quand le quota est epuise', async () => {
    photoFindUnique.mockResolvedValue(null);
    consumeShot.mockResolvedValue({ remaining: -1, fromBonus: false });

    await expect(reserveShot(roll, input)).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' });
    expect(photoCreate).not.toHaveBeenCalled();
  });

  it('refuse quand l evenement est ferme depuis longtemps, sans toucher au quota', async () => {
    photoFindUnique.mockResolvedValue(null);
    eventFindUnique.mockResolvedValue({
      id: 'e1', state: 'CLOSED', closesAt: new Date(Date.now() - 5 * 3_600_000),
    });

    await expect(reserveShot(roll, input)).rejects.toMatchObject({ code: 'EVENT_CLOSED' });
    // La verification est faite AVANT le decrement : aucune pose perdue.
    expect(consumeShot).not.toHaveBeenCalled();
  });

  it('accepte une photographie prise avant la fermeture, pendant le delai de grace', async () => {
    photoFindUnique.mockResolvedValue(null);
    const closedAt = new Date(Date.now() - 30 * 60_000); // ferme il y a 30 min
    eventFindUnique.mockResolvedValue({ id: 'e1', state: 'CLOSED', closesAt: closedAt });
    consumeShot.mockResolvedValue({ remaining: 23, fromBonus: false });
    photoCreate.mockResolvedValue({ id: 'p5' });

    // Prise 40 minutes avant la fermeture, envoyee maintenant : c'est le
    // scenario de l'invite qui retrouve du reseau apres la soiree.
    const taken = new Date(closedAt.getTime() - 10 * 60_000);
    await expect(reserveShot(roll, { ...input, takenAt: taken })).resolves.toBeTruthy();
  });

  it('refuse une photographie prise APRES la fermeture, meme pendant le delai', async () => {
    photoFindUnique.mockResolvedValue(null);
    const closedAt = new Date(Date.now() - 30 * 60_000);
    eventFindUnique.mockResolvedValue({ id: 'e1', state: 'CLOSED', closesAt: closedAt });

    const taken = new Date(closedAt.getTime() + 60_000);
    await expect(reserveShot(roll, { ...input, takenAt: taken }))
      .rejects.toMatchObject({ code: 'EVENT_CLOSED' });
  });

  it('rend la pose si l enregistrement echoue apres le decrement', async () => {
    photoFindUnique.mockResolvedValue(null);
    consumeShot.mockResolvedValue({ remaining: 23, fromBonus: false });
    transaction.mockRejectedValue(new Error('base indisponible'));

    await expect(reserveShot(roll, input)).rejects.toThrow('base indisponible');
    // Sans cette restitution, l invite perdrait une pose sans photographie.
    expect(refundShot).toHaveBeenCalledWith('r1', false);
  });

  it('consomme une pose bonus sans toucher au quota principal', async () => {
    photoFindUnique.mockResolvedValue(null);
    consumeShot.mockResolvedValue({ remaining: 2, fromBonus: true });
    photoCreate.mockResolvedValue({ id: 'p2' });

    const res = await reserveShot(roll, input);

    expect(res.fromBonus).toBe(true);
    // Le quota persistant n est pas modifie : les poses bonus n en font pas partie.
    expect(rollUpdate).not.toHaveBeenCalled();
  });

  it('rattache la photographie au moment fort en cours', async () => {
    photoFindUnique.mockResolvedValue(null);
    consumeShot.mockResolvedValue({ remaining: 23, fromBonus: false });
    momentFindMany.mockResolvedValue([
      { id: 'm1', startedAt: new Date(Date.now() - 60_000), durationMinutes: 10 },
    ]);
    photoCreate.mockResolvedValue({ id: 'p3' });

    await reserveShot(roll, input);
    expect(photoCreate.mock.calls[0]![0].data.momentId).toBe('m1');
  });

  it('ignore un moment fort dont la fenetre est expiree', async () => {
    photoFindUnique.mockResolvedValue(null);
    consumeShot.mockResolvedValue({ remaining: 23, fromBonus: false });
    momentFindMany.mockResolvedValue([
      { id: 'm1', startedAt: new Date(Date.now() - 20 * 60_000), durationMinutes: 10 },
    ]);
    photoCreate.mockResolvedValue({ id: 'p4' });

    await reserveShot(roll, input);
    expect(photoCreate.mock.calls[0]![0].data.momentId).toBeNull();
  });
});

describe('acceptsPhotos', () => {
  const closesAt = new Date(Date.now() - 60 * 60_000); // ferme il y a une heure

  it('accepte tout tant que l evenement est ouvert', () => {
    expect(acceptsPhotos({ state: 'OPEN', closesAt }, new Date())).toBe(true);
  });

  it('accepte une prise anterieure a la fermeture pendant deux heures', () => {
    expect(acceptsPhotos({ state: 'CLOSED', closesAt }, new Date(closesAt.getTime() - 1000))).toBe(true);
  });

  it('refuse au-dela du delai de grace', () => {
    const vieux = new Date(Date.now() - 5 * 3_600_000);
    expect(acceptsPhotos({ state: 'CLOSED', closesAt: vieux }, new Date(vieux.getTime() - 1000))).toBe(false);
  });

  it('refuse un evenement publie ou purge', () => {
    expect(acceptsPhotos({ state: 'PUBLISHED', closesAt }, new Date(closesAt.getTime() - 1000))).toBe(false);
  });
});

describe('confirmUpload', () => {
  it('passe la photographie a l etat deposee', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', rollId: 'r1', status: 'RESERVED' });
    photoUpdate.mockResolvedValue({ id: 'p1', status: 'UPLOADED' });

    await expect(confirmUpload(roll, KEY)).resolves.toMatchObject({ status: 'UPLOADED' });
  });

  it('est idempotente : une confirmation rejouee ne change rien', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', rollId: 'r1', status: 'UPLOADED' });

    await expect(confirmUpload(roll, KEY)).resolves.toMatchObject({ status: 'UPLOADED' });
    expect(photoUpdate).not.toHaveBeenCalled();
  });

  it('refuse de confirmer la photographie d une autre pellicule', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', rollId: 'AUTRE', status: 'RESERVED' });
    await expect(confirmUpload(roll, KEY)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
