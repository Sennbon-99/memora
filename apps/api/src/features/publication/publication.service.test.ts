// apps/api/src/features/publication/publication.service.test.ts
// Tests du service de publication. Le moteur de visibilite est teste a part,
// dans visibility.test.ts : ici on verifie l'orchestration.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const eventFindUnique = vi.fn();
const eventUpdate = vi.fn();
const photoFindMany = vi.fn();
const photoUpdateMany = vi.fn();
const photoUpdate = vi.fn();
const requestFindUnique = vi.fn();
const requestUpdate = vi.fn();
const transaction = vi.fn();
const signRead = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    event: { findUnique: eventFindUnique, update: eventUpdate },
    photo: { findMany: photoFindMany, updateMany: photoUpdateMany, update: photoUpdate },
    removalRequest: { findUnique: requestFindUnique, update: requestUpdate },
    $transaction: transaction,
  },
}));
vi.mock('../../config/storage.js', () => ({ signRead }));

const { getAlbumForHost, publishAlbum, getPublicAlbum, handleRemoval } =
  await import('./publication.service.js');

const closedEvent = {
  id: 'e1', ownerId: 'u1', state: 'CLOSED', scope: 'NONE',
  albumToken: null as string | null, accessCodeHash: null as string | null,
  name: 'Mariage', color: '#B0741C', coHosts: [] as unknown[],
};

beforeEach(() => {
  [eventFindUnique, eventUpdate, photoFindMany, photoUpdateMany, photoUpdate,
   requestFindUnique, requestUpdate, transaction, signRead].forEach((m) => m.mockReset());
  signRead.mockImplementation(async (key: string) => `https://minio.local/${key}?sig=x`);
  transaction.mockImplementation(async (ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : ops,
  );
});

describe('getAlbumForHost', () => {
  it("refuse tant que l'evenement n'est pas ferme", async () => {
    eventFindUnique.mockResolvedValue({ ...closedEvent, state: 'OPEN' });
    await expect(getAlbumForHost('e1', 'u1')).rejects.toMatchObject({ code: 'NOT_CLOSED' });
  });

  it('inclut les photographies masquees, que l hote doit arbitrer', async () => {
    eventFindUnique.mockResolvedValue(closedEvent);
    photoFindMany.mockResolvedValue([
      { id: 'p1', objectKey: 'k1', takenAt: new Date(), status: 'UPLOADED', published: false,
        width: 100, height: 100, roll: { id: 'r1', firstName: 'Camille', table: { label: 'Table 1' } }, moment: null },
    ]);

    const album = await getAlbumForHost('e1', 'u1');

    expect(album[0]).toMatchObject({ rollId: 'r1', firstName: 'Camille', tableLabel: 'Table 1' });
    // La cle brute ne sort jamais : seule une adresse signee est exposee.
    expect(album[0]).not.toHaveProperty('objectKey');
    expect(album[0]!.url).toContain('sig=');
  });

  it('expose un invite anonyme sans lui inventer de nom', async () => {
    eventFindUnique.mockResolvedValue(closedEvent);
    photoFindMany.mockResolvedValue([
      { id: 'p1', objectKey: 'k1', takenAt: new Date(), status: 'UPLOADED', published: false,
        width: 100, height: 100, roll: { id: 'r2', firstName: null, table: null }, moment: null },
    ]);

    const album = await getAlbumForHost('e1', 'u1');
    expect(album[0]!.firstName).toBeNull();
    expect(album[0]!.tableLabel).toBeNull();
  });
});

describe('publishAlbum', () => {
  it('remet tout a zero avant de marquer la nouvelle selection', async () => {
    eventFindUnique.mockResolvedValue(closedEvent);
    eventUpdate.mockResolvedValue({ id: 'e1', scope: 'EVERYONE', albumToken: 'tok' });

    await publishAlbum('e1', 'u1', { scope: 'EVERYONE', photoIds: ['p1', 'p2'] });

    // Premier updateMany : tout depublier. Second : publier la selection.
    // Sans le premier, une photo retiree du tri resterait accessible.
    expect(photoUpdateMany).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ data: { published: false } }));
    expect(photoUpdateMany).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ data: { published: true } }));
  });

  it('ne publie que les photographies effectivement deposees', async () => {
    eventFindUnique.mockResolvedValue(closedEvent);
    eventUpdate.mockResolvedValue({ id: 'e1', scope: 'EVERYONE', albumToken: 'tok' });

    await publishAlbum('e1', 'u1', { scope: 'EVERYONE', photoIds: ['p1'] });

    // Une photo restee a l'etat RESERVED n'a pas de fichier : la publier
    // donnerait une vignette cassee dans l'album.
    expect(photoUpdateMany.mock.calls[1]![0].where).toMatchObject({ status: 'UPLOADED' });
  });

  it('conserve le jeton d album si l evenement a deja ete publie', async () => {
    eventFindUnique.mockResolvedValue({ ...closedEvent, state: 'PUBLISHED', albumToken: 'ancien' });
    eventUpdate.mockResolvedValue({ id: 'e1', scope: 'EVERYONE', albumToken: 'ancien' });

    await publishAlbum('e1', 'u1', { scope: 'EVERYONE', photoIds: [] });

    // Republier ne doit pas casser les liens deja partages aux invites.
    expect(eventUpdate.mock.calls[0]![0].data.albumToken).toBe('ancien');
  });

  it('refuse de publier un evenement encore ouvert', async () => {
    eventFindUnique.mockResolvedValue({ ...closedEvent, state: 'OPEN' });
    await expect(publishAlbum('e1', 'u1', { scope: 'EVERYONE', photoIds: [] }))
      .rejects.toMatchObject({ code: 'NOT_CLOSED' });
  });
});

describe('getPublicAlbum', () => {
  const publishedEvent = {
    id: 'e1', name: 'Mariage', color: '#B0741C',
    state: 'PUBLISHED', scope: 'OWN_ONLY', accessCodeHash: null,
  };

  it('ne montre a un invite que sa propre pellicule', async () => {
    eventFindUnique.mockResolvedValue(publishedEvent);
    photoFindMany.mockResolvedValue([
      { id: 'p1', objectKey: 'k1', takenAt: new Date(), width: 1, height: 1, published: true, status: 'UPLOADED', rollId: 'r1' },
      { id: 'p2', objectKey: 'k2', takenAt: new Date(), width: 1, height: 1, published: true, status: 'UPLOADED', rollId: 'r2' },
    ]);

    const album = await getPublicAlbum('tok', { kind: 'GUEST', rollId: 'r1' });

    expect(album.photos).toHaveLength(1);
    expect(album.photos[0]!.id).toBe('p1');
  });

  it('exige le code quand l hote en a active un', async () => {
    eventFindUnique.mockResolvedValue({ ...publishedEvent, accessCodeHash: 'un-hash' });
    await expect(getPublicAlbum('tok', { kind: 'LINK' }))
      .rejects.toMatchObject({ code: 'ACCESS_CODE_REQUIRED' });
  });

  it('refuse un jeton inconnu', async () => {
    eventFindUnique.mockResolvedValue(null);
    await expect(getPublicAlbum('inconnu', { kind: 'LINK' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('expose une adresse signee et jamais le champ objectKey', async () => {
    eventFindUnique.mockResolvedValue({ ...publishedEvent, scope: 'EVERYONE' });
    photoFindMany.mockResolvedValue([
      { id: 'p1', objectKey: 'e1/r1/photo.jpg', takenAt: new Date(), width: 1, height: 1, published: true, status: 'UPLOADED', rollId: 'r1' },
    ]);

    const album = await getPublicAlbum('tok', { kind: 'LINK' });

    // La cle brute ne doit pas figurer comme champ : sans signature, elle
    // ne donne acces a rien, mais elle revele l'arborescence du stockage.
    expect(album.photos[0]).not.toHaveProperty('objectKey');
    expect(album.photos[0]).not.toHaveProperty('published');
    expect(album.photos[0]).not.toHaveProperty('status');
    expect(album.photos[0]!.url).toContain('sig=');
  });
});

describe('handleRemoval', () => {
  const pending = {
    id: 'req1', state: 'PENDING', photoId: 'p1',
    photo: { roll: { eventId: 'e1' } },
  };

  it('retire definitivement la photographie quand l hote accepte', async () => {
    requestFindUnique.mockResolvedValue(pending);
    eventFindUnique.mockResolvedValue(closedEvent);
    requestUpdate.mockResolvedValue({ id: 'req1', state: 'ACCEPTED' });

    await handleRemoval('req1', 'u1', true);

    expect(photoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REMOVED' } }));
  });

  it('remet la photographie en ligne quand l hote refuse', async () => {
    requestFindUnique.mockResolvedValue(pending);
    eventFindUnique.mockResolvedValue(closedEvent);
    requestUpdate.mockResolvedValue({ id: 'req1', state: 'REFUSED' });

    await handleRemoval('req1', 'u1', false);

    // Le masquage etait conservatoire : un refus le leve.
    expect(photoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'UPLOADED' } }));
  });

  it('refuse de traiter deux fois la meme demande', async () => {
    requestFindUnique.mockResolvedValue({ ...pending, state: 'ACCEPTED' });
    eventFindUnique.mockResolvedValue(closedEvent);

    await expect(handleRemoval('req1', 'u1', true))
      .rejects.toMatchObject({ code: 'ALREADY_HANDLED' });
  });
});
