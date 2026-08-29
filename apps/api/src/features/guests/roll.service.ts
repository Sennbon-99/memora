// apps/api/src/features/guests/roll.service.ts
// Les pellicules vues par l'hote.
//
// C'est l'entree du tri : l'hote choisit une pellicule, trie ses vingt-quatre
// photographies, et passe a la suivante. Une pellicule est une tache bornee,
// contrairement a une heure de soiree qui peut en contenir trois cents.

import { prisma } from '../../config/prisma.js';
import { assertCanManage } from '../events/event.service.js';

export interface RollSummary {
  id: string;
  firstName: string | null;
  tableLabel: string | null;
  /** Photographies effectivement deposees, hors reservations abandonnees. */
  photos: number;
  /** Photographies masquees par l'hote pendant le tri. */
  hidden: number;
  /** Vrai des que l'hote a fini de trier cette pellicule. */
  reviewed: boolean;
  /** Une demande de retrait en attente sur cette pellicule. */
  pendingRemoval: boolean;
}

/**
 * Liste les pellicules d'un evenement, avec de quoi decider laquelle ouvrir.
 *
 * Les reservations abandonnees (statut RESERVED, fichier jamais depose) sont
 * exclues du compte : les afficher ferait croire a l'hote qu'il reste des
 * photographies a trier alors qu'il n'existe aucun fichier.
 */
export async function listRolls(eventId: string, userId: string): Promise<RollSummary[]> {
  await assertCanManage(eventId, userId);

  const rolls = await prisma.roll.findMany({
    where: { eventId },
    orderBy: [{ reviewedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    select: {
      id: true,
      firstName: true,
      reviewedAt: true,
      table: { select: { label: true } },
      photos: { select: { status: true } },
      requests: { where: { state: 'PENDING' }, select: { id: true } },
    },
  });

  return rolls.map((roll) => {
    const deposees = roll.photos.filter((photo) => photo.status !== 'RESERVED');

    return {
      id: roll.id,
      firstName: roll.firstName,
      tableLabel: roll.table?.label ?? null,
      photos: deposees.length,
      hidden: deposees.filter((photo) => photo.status === 'HIDDEN').length,
      reviewed: roll.reviewedAt !== null,
      pendingRemoval: roll.requests.length > 0,
    };
  });
}

/**
 * Enregistre le resultat du tri d'une pellicule.
 *
 * Le principe retenu : le non-choix vaut conservation. L'hote ne touche que
 * ce qu'il ecarte, et tout le reste est garde. Sur un millier d'images, cela
 * represente cent gestes au lieu de mille, et une pellicule abandonnee en
 * cours de route reste publiable telle quelle.
 */
export async function reviewRoll(
  eventId: string,
  rollId: string,
  userId: string,
  hiddenPhotoIds: string[],
) {
  await assertCanManage(eventId, userId);

  const roll = await prisma.roll.findFirst({ where: { id: rollId, eventId }, select: { id: true } });
  if (!roll) return null;

  // Une seule transaction : on ne veut pas d'une pellicule marquee triee
  // alors que les masquages n'ont pas ete ecrits.
  const [, kept] = await prisma.$transaction([
    prisma.photo.updateMany({
      where: { rollId, status: { in: ['UPLOADED', 'HIDDEN'] } },
      data: { status: 'UPLOADED' },
    }),
    prisma.photo.updateMany({
      where: { rollId, id: { in: hiddenPhotoIds } },
      data: { status: 'HIDDEN' },
    }),
    prisma.roll.update({ where: { id: rollId }, data: { reviewedAt: new Date() } }),
  ]);

  return { rollId, hidden: kept.count };
}
