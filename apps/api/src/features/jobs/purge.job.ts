// apps/api/src/features/jobs/purge.job.ts
// Suppression des medias trente jours apres la fermeture de l'evenement.
//
// C'est la mise en oeuvre concrete de la limitation de conservation exigee
// par le RGPD. La suppression est effective, dans le stockage objet comme
// dans la base : ce n'est pas un simple marquage.

import { RETENTION_DAYS } from '@memora/types';
import { prisma } from '../../config/prisma.js';
import { deleteObjects } from '../../config/storage.js';
import type { JobReport } from './closeEvents.job.js';

/** Nombre d'objets supprimes par appel au stockage. */
const BATCH_SIZE = 500;

/**
 * Purge les evenements dont la fermeture remonte a plus de trente jours.
 *
 * L'ordre des operations n'est pas indifferent : on supprime d'abord les
 * fichiers, puis les enregistrements. Dans l'autre sens, un echec entre les
 * deux laisserait des fichiers orphelins dans le stockage, sans plus aucune
 * trace en base permettant de les retrouver.
 */
export async function purgeExpiredEvents(now = new Date()): Promise<JobReport> {
  const threshold = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const expired = await prisma.event.findMany({
    where: {
      state: { in: ['CLOSED', 'PUBLISHED'] },
      closesAt: { lte: threshold },
    },
    select: { id: true, name: true },
  });
  if (expired.length === 0) return { processed: 0, ids: [] };

  const ids: string[] = [];

  for (const event of expired) {
    const photos = await prisma.photo.findMany({
      where: { roll: { eventId: event.id } },
      select: { objectKey: true },
    });

    // 1. Les fichiers, par lots : le stockage limite le nombre de cles
    //    supprimables en une seule requete.
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE).map((p) => p.objectKey);
      await deleteObjects(batch);
    }

    // 2. Les enregistrements. Les suppressions en cascade declarees dans le
    //    schema emportent pellicules, photographies, moments et demandes.
    await prisma.event.update({
      where: { id: event.id },
      data: { state: 'PURGED', albumToken: null, accessCodeHash: null },
    });
    await prisma.roll.deleteMany({ where: { eventId: event.id } });

    ids.push(event.id);
    console.log(`Purge : ${photos.length} photographie(s) supprimee(s) pour "${event.name}"`);
  }

  return { processed: ids.length, ids };
}
