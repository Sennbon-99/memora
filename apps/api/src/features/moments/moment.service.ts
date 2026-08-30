// apps/api/src/features/moments/moment.service.ts
// Les moments forts : discours, ouverture du bal, gateau.
//
// Le principe : l'hote ouvre une fenetre de quelques minutes pendant laquelle
// chaque invite recoit des poses supplementaires, valables uniquement le temps
// du moment. Les photographies prises pendant la fenetre lui sont rattachees,
// ce qui decoupe l'album en chapitres sans que l'hote ait rien a faire.
//
// Le declenchement est manuel par defaut : aucun mariage ne suit son planning,
// et un moment qui se declenche pendant que la mariee est aux toilettes ne
// rattrape rien.

import type { CreateMomentInput } from '@memora/types';
import { prisma } from '../../config/prisma.js';
import { grantBonusShots } from '../../config/redis.js';
import { assertCanManage } from '../events/event.service.js';
import { compact } from '../../utils/object.js';
import { AppError, NotFoundError } from '../../utils/errors.js';

/** Un moment est actif s'il a demarre et que sa fenetre n'est pas expiree. */
export function isActive(moment: {
  startedAt: Date | null;
  endedAt?: Date | null;
  durationMinutes: number;
}): boolean {
  if (!moment.startedAt) return false;
  // Une fermeture anticipee fait foi, quelle que soit la duree prevue.
  if (moment.endedAt) return false;
  return Date.now() < moment.startedAt.getTime() + moment.durationMinutes * 60_000;
}

/** Programme un moment. Il ne demarre pas pour autant. */
export async function createMoment(eventId: string, userId: string, input: CreateMomentInput) {
  await assertCanManage(eventId, userId);

  return prisma.moment.create({
    data: { ...compact(input), eventId },
    select: { id: true, label: true, plannedAt: true, durationMinutes: true, bonusShots: true },
  });
}

/** Le programme de la soiree, avec l'etat de chaque moment. */
export async function listMoments(eventId: string, userId: string) {
  await assertCanManage(eventId, userId);

  const moments = await prisma.moment.findMany({
    where: { eventId },
    orderBy: [{ plannedAt: 'asc' }, { label: 'asc' }],
    select: {
      id: true, label: true, plannedAt: true, startedAt: true, endedAt: true,
      durationMinutes: true, bonusShots: true,
      _count: { select: { photos: true } },
    },
  });

  return moments.map((moment) => ({
    ...moment,
    active: isActive(moment),
    photoCount: moment._count.photos,
  }));
}

/**
 * Declenche un moment : ouvre la fenetre et credite les poses supplementaires.
 *
 * Les poses sont ecrites dans Redis avec une expiration egale a la duree du
 * moment. Rien n'a donc besoin d'etre nettoye ensuite : les poses non
 * utilisees disparaissent d'elles-memes a la seconde pres.
 */
export async function triggerMoment(momentId: string, userId: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { id: true, label: true, eventId: true, startedAt: true, durationMinutes: true, bonusShots: true },
  });
  if (!moment) throw new NotFoundError('Moment');

  const { event } = await assertCanManage(moment.eventId, userId);
  if (event.state !== 'OPEN') {
    throw new AppError('EVENT_NOT_OPEN', 409, "L'événement doit être ouvert pour déclencher un moment");
  }
  if (moment.startedAt) {
    throw new AppError('ALREADY_STARTED', 409, 'Ce moment a déjà été déclenché');
  }

  // Deux moments ne peuvent pas se chevaucher : les poses bonus etant
  // comptees dans un seul compteur par pellicule, deux fenetres simultanees
  // rendraient le decompte incomprehensible pour l'invite.
  const others = await prisma.moment.findMany({
    where: { eventId: moment.eventId, startedAt: { not: null }, id: { not: momentId } },
    select: { startedAt: true, durationMinutes: true },
  });
  if (others.some(isActive)) {
    throw new AppError('MOMENT_OVERLAP', 409, 'Un autre moment est déjà en cours');
  }

  const startedAt = new Date();
  const ttlSeconds = moment.durationMinutes * 60;

  const rolls = await prisma.roll.findMany({
    where: { eventId: moment.eventId },
    select: { id: true },
  });

  await prisma.moment.update({ where: { id: momentId }, data: { startedAt } });

  // Chaque pellicule recoit ses poses bonus. On les pose en parallele :
  // pour deux cents invites, une boucle sequentielle prendrait plusieurs
  // secondes pendant lesquelles les premiers pourraient deja photographier.
  await Promise.all(rolls.map((roll) => grantBonusShots(roll.id, moment.bonusShots, ttlSeconds)));

  return {
    id: moment.id,
    label: moment.label,
    startedAt,
    endsAt: new Date(startedAt.getTime() + ttlSeconds * 1000),
    bonusShots: moment.bonusShots,
    guestsNotified: rolls.length,
  };
}

/**
 * Clot un moment avant son terme.
 * Les poses bonus sont retirees immediatement : l'hote a decide que la scene
 * etait passee, il n'y a plus de raison de photographier en bonus.
 */
export async function closeMoment(momentId: string, userId: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { id: true, eventId: true, startedAt: true, endedAt: true, durationMinutes: true },
  });
  if (!moment) throw new NotFoundError('Moment');
  await assertCanManage(moment.eventId, userId);

  if (!isActive(moment)) {
    throw new AppError('NOT_ACTIVE', 409, "Ce moment n'est pas en cours");
  }

  const rolls = await prisma.roll.findMany({
    where: { eventId: moment.eventId },
    select: { id: true },
  });
  // Un credit a zero avec une expiration d'une seconde revient a le supprimer,
  // tout en restant coherent si une requete arrive au meme instant.
  await Promise.all(rolls.map((roll) => grantBonusShots(roll.id, 0, 1)));

  // On pose la date de fin plutot que de rogner la duree. Rogner obligeait
  // a arrondir a la minute superieure, et un moment ferme au bout de vingt
  // secondes restait annonce comme en cours pendant quarante secondes.
  await prisma.moment.update({ where: { id: momentId }, data: { endedAt: new Date() } });

  return { id: moment.id, closed: true };
}
