// apps/api/src/features/download/download.service.test.ts
// Tests du nommage des entrees de l'archive. La diffusion elle-meme n'est
// pas testee ici : elle depend du stockage objet et se verifie sur le
// fichier produit.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma.js', () => ({ prisma: { roll: { findMany: vi.fn() }, event: { findUnique: vi.fn() } } }));
vi.mock('../../config/storage.js', () => ({ s3: { send: vi.fn() } }));

const { buildEntryName, buildRollLabel } = await import('./download.service.js');

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
