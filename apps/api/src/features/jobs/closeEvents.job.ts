// apps/api/src/features/jobs/closeEvents.job.ts
// Fermeture automatique des evenements arrives a echeance.
//
// L'hote a fixe une heure de fermeture au moment de la configuration ; il ne
// doit pas avoir a y penser pendant sa soiree. Cette tache s'en charge, et
// c'est elle qui declenche le compte a rebours de trente jours avant purge.

import { prisma } from '../../config/prisma.js';

export interface JobReport {
  processed: number;
  ids: string[];
}

/**
 * Ferme tous les evenements ouverts dont l'heure de fermeture est passee.
 *
 * La requete est volontairement un updateMany plutot qu'une boucle : elle
 * s'execute en une seule instruction, et deux instances du travailleur
 * lancees en meme temps ne peuvent pas fermer deux fois le meme evenement.
 */
export async function closeExpiredEvents(now = new Date()): Promise<JobReport> {
  const expired = await prisma.event.findMany({
    where: { state: 'OPEN', closesAt: { lte: now } },
    select: { id: true },
  });
  if (expired.length === 0) return { processed: 0, ids: [] };

  const ids = expired.map((e) => e.id);
  await prisma.event.updateMany({
    where: { id: { in: ids }, state: 'OPEN' },
    data: { state: 'CLOSED' },
  });

  console.log(`Fermeture automatique : ${ids.length} evenement(s)`);
  return { processed: ids.length, ids };
}
