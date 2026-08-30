// apps/api/src/features/download/download.service.ts
// Telechargement de l'album en archive.
//
// Contrainte dimensionnante : deux cents invites a vingt-quatre poses font
// pres de cinq mille fichiers, soit plusieurs gigaoctets. Construire l'archive
// en memoire ferait tomber le processus. On la diffuse donc au fil de l'eau :
// chaque fichier est lu depuis le stockage et pousse immediatement dans le
// flux de reponse, sans jamais tenir l'ensemble en memoire.

import type { Writable } from 'node:stream';
// Archiver 8 n'expose plus d'export par defaut : on instancie la classe.
import { ZipArchive } from 'archiver';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { s3 } from '../../config/storage.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { assertCanManage } from '../events/event.service.js';
import { AppError } from '../../utils/errors.js';

/** Nom de fichier lisible : pellicule, horodatage, rang. */
export function buildEntryName(
  photo: { takenAt: Date; id: string },
  rollLabel: string,
  index: number,
): string {
  const stamp = photo.takenAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${rollLabel}/${String(index + 1).padStart(3, '0')}-${stamp}.jpg`;
}

/** Libelle d'une pellicule dans l'archive : le prenom, ou un numero anonyme. */
export function buildRollLabel(
  roll: { firstName: string | null; id: string },
  rank: number,
): string {
  return roll.firstName ?? `pellicule-${String(rank + 1).padStart(2, '0')}`;
}

/**
 * Construit l'archive et la pousse dans le flux de sortie.
 *
 * Les originaux ne sont jamais recompresses : l'hote doit recuperer le
 * fichier exact que son invite a pris, sinon la promesse de haute definition
 * n'est pas tenue. Le niveau de compression est donc a zero — un JPEG est
 * deja compresse, tenter de le recompresser coute du temps pour rien.
 */
export async function streamAlbumArchive(
  eventId: string,
  userId: string,
  output: Writable,
): Promise<void> {
  const { event } = await assertCanManage(eventId, userId);
  if (event.state === 'DRAFT' || event.state === 'OPEN') {
    throw new AppError('NOT_CLOSED', 409, "L'album n'est disponible qu'après la fermeture");
  }

  const rolls = await prisma.roll.findMany({
    where: { eventId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, firstName: true,
      photos: {
        where: { status: 'UPLOADED' },
        orderBy: { takenAt: 'asc' },
        select: { id: true, objectKey: true, takenAt: true },
      },
    },
  });

  const archive = new ZipArchive({ zlib: { level: 0 } });
  archive.pipe(output);

  for (const [rank, roll] of rolls.entries()) {
    const label = buildRollLabel(roll, rank);

    for (const [index, photo] of roll.photos.entries()) {
      const object = await s3.send(
        new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: photo.objectKey }),
      );
      if (!object.Body) continue;

      archive.append(object.Body as Readable, {
        name: buildEntryName(photo, label, index),
        date: photo.takenAt,
      });
    }
  }

  await archive.finalize();
}
