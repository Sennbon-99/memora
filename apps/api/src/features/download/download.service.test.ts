// apps/api/src/features/download/download.service.test.ts
// Tests du nommage des entrees de l'archive. La diffusion elle-meme n'est
// pas testee ici : elle depend du stockage objet et se verifie sur le
// fichier produit.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const rollFindMany = vi.fn();
const eventFindUnique = vi.fn();
const s3Send = vi.fn();
const append = vi.fn();
const pipe = vi.fn();
const finalize = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: { roll: { findMany: rollFindMany }, event: { findUnique: eventFindUnique } },
}));
vi.mock('../../config/storage.js', () => ({ s3: { send: s3Send } }));
vi.mock('archiver', () => ({
  ZipArchive: class { append = append; pipe = pipe; finalize = finalize; },
}));

const { buildEntryName, buildRollLabel, streamAlbumArchive } =
  await import('./download.service.js');

describe('buildRollLabel', () => {
  it('utilise le prenom quand il a ete donne', () => {
    expect(buildRollLabel({ firstName: 'Camille', id: 'r1' }, 0)).toBe('Camille');
  });

  it('numerote les pellicules anonymes sans inventer de nom', () => {
    expect(buildRollLabel({ firstName: null, id: 'r2' }, 4)).toBe('pellicule-05');
  });
});

describe('buildEntryName', () => {
  it('classe les photographies par ordre de prise de vue', () => {
    const photo = { takenAt: new Date('2026-08-15T21:34:12Z'), id: 'p1' };

    const name = buildEntryName(photo, 'Camille', 0);

    // Le rang en tete garantit que l'ordre du dossier suit celui de la soiree,
    // meme quand l'explorateur de fichiers trie par nom.
    expect(name).toBe('Camille/001-2026-08-15-21-34-12.jpg');
  });

  it('remplit le rang sur trois chiffres pour rester trie au-dela de dix', () => {
    const photo = { takenAt: new Date('2026-08-15T21:34:12Z'), id: 'p1' };
    expect(buildEntryName(photo, 'Camille', 11)).toContain('/012-');
  });
});

describe('streamAlbumArchive', () => {
  const closed = { id: 'e1', ownerId: 'u1', state: 'CLOSED', coHosts: [] as unknown[] };

  beforeEach(() => {
    [rollFindMany, eventFindUnique, s3Send, append, pipe, finalize].forEach((m) => m.mockReset());
    eventFindUnique.mockResolvedValue(closed);
    s3Send.mockResolvedValue({ Body: 'flux-binaire' });
  });

  it("refuse tant que l'evenement n'est pas ferme", async () => {
    eventFindUnique.mockResolvedValue({ ...closed, state: 'OPEN' });
    await expect(streamAlbumArchive('e1', 'u1', {} as never))
      .rejects.toMatchObject({ code: 'NOT_CLOSED' });
  });

  it('ajoute une entree par photographie, rangee par pellicule', async () => {
    rollFindMany.mockResolvedValue([
      { id: 'r1', firstName: 'Camille', photos: [
        { id: 'p1', objectKey: 'k1', takenAt: new Date('2026-08-15T21:00:00Z') },
        { id: 'p2', objectKey: 'k2', takenAt: new Date('2026-08-15T21:05:00Z') },
      ] },
      { id: 'r2', firstName: null, photos: [
        { id: 'p3', objectKey: 'k3', takenAt: new Date('2026-08-15T22:00:00Z') },
      ] },
    ]);

    await streamAlbumArchive('e1', 'u1', {} as never);

    expect(append).toHaveBeenCalledTimes(3);
    expect(append.mock.calls[0]![1].name).toContain('Camille/001-');
    // La pellicule anonyme est numerotee, pas nommee arbitrairement.
    expect(append.mock.calls[2]![1].name).toContain('pellicule-02/001-');
    expect(finalize).toHaveBeenCalled();
  });

  it('ignore une photographie dont le fichier est introuvable', async () => {
    rollFindMany.mockResolvedValue([
      { id: 'r1', firstName: 'Camille', photos: [{ id: 'p1', objectKey: 'k1', takenAt: new Date() }] },
    ]);
    s3Send.mockResolvedValue({ Body: undefined });

    await streamAlbumArchive('e1', 'u1', {} as never);

    // Un objet manquant ne doit pas interrompre toute l'archive.
    expect(append).not.toHaveBeenCalled();
    expect(finalize).toHaveBeenCalled();
  });
});
