// 🧠 apps/api/src/features/events/event.service.ts
// Regles metier de l'evenement : creation, configuration, ouverture, fermeture.

import type { CreateEventInput, UpdateEventInput } from '@memora/types';
import { MAX_GUESTS_PER_EVENT } from '@memora/types';
import { prisma } from '../../config/prisma.js';
import { buildEventSlug, buildToken } from '../../utils/slug.js';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors.js';

/** Limites de l'offre gratuite, appliquees au premier evenement d'un compte. */
const FREE_TIER = { events: 1, guests: 20, shots: 10 } as const;

/**
 * Verifie que l'utilisateur a le droit d'agir sur cet evenement.
 * C'est la matrice des roles de la partie 2.1.4.b du dossier, appliquee
 * cote serveur. L'interface se contente de masquer ce qui n'est pas permis :
 * elle n'est jamais l'autorite.
 */
export async function assertCanManage(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { coHosts: { where: { userId }, select: { userId: true } } },
  });
  if (!event) throw new NotFoundError('Evenement');

  const isOwner = event.ownerId === userId;
  const isCoHost = event.coHosts.length > 0;
  if (!isOwner && !isCoHost) throw new ForbiddenError('Cet evenement ne vous appartient pas');

  return { event, isOwner };
}

/** Cree un evenement a l'etat brouillon. Aucun invite ne peut le rejoindre. */
export async function createEvent(userId: string, input: CreateEventInput) {
  // Le premier evenement d'un compte est offert, mais bride : dix poses au lieu
  // du quota demande. Au-dela, l'ouverture exigera un paiement (voir openEvent).
  const alreadyCreated = await prisma.event.count({ where: { ownerId: userId } });
  const isFirstEvent = alreadyCreated === 0;

  return prisma.event.create({
    data: {
      ...input,
      slug: buildEventSlug(input.name),
      ownerId: userId,
      quotaShots: isFirstEvent ? Math.min(input.quotaShots, FREE_TIER.shots) : input.quotaShots,
    },
  });
}

/** Liste les evenements dont l'utilisateur est hote ou co-hote. */
export async function listEvents(userId: string) {
  return prisma.event.findMany({
    where: { OR: [{ ownerId: userId }, { coHosts: { some: { userId } } }] },
    orderBy: { eventDate: 'desc' },
    select: {
      id: true, name: true, slug: true, type: true, eventDate: true,
      state: true, quotaShots: true, closesAt: true, color: true,
      _count: { select: { rolls: true } },
    },
  });
}

/** Detail d'un evenement, pour l'espace de l'hote. */
export async function getEvent(eventId: string, userId: string) {
  const { event } = await assertCanManage(eventId, userId);
  return event;
}

/**
 * Modifie la configuration. Trois reglages sont figes des l'ouverture :
 * changer le quota ou le mode d'apercu en pleine soiree creerait une
 * inegalite entre les invites deja arrives et ceux qui arrivent apres.
 */
export async function updateEvent(eventId: string, userId: string, input: UpdateEventInput) {
  const { event } = await assertCanManage(eventId, userId);

  if (event.state !== 'DRAFT') {
    const locked = ['quotaShots', 'previewMode', 'type'] as const;
    const attempted = locked.filter((field) => input[field] !== undefined);
    if (attempted.length > 0) {
      throw new AppError(
        'EVENT_LOCKED',
        409,
        `Ces reglages ne sont plus modifiables une fois l'evenement ouvert : ${attempted.join(', ')}`,
      );
    }
  }

  return prisma.event.update({ where: { id: eventId }, data: input });
}

/**
 * Ouvre l'evenement : les invites peuvent desormais scanner et photographier.
 * C'est ici que se joue le controle du paiement.
 */
export async function openEvent(eventId: string, userId: string) {
  const { event, isOwner } = await assertCanManage(eventId, userId);
  if (!isOwner) throw new ForbiddenError("Seul l'hote peut ouvrir l'evenement");
  if (event.state !== 'DRAFT') throw new AppError('ALREADY_OPEN', 409, 'Cet evenement est deja ouvert');

  // L'offre gratuite couvre un seul evenement par compte : on compte ceux
  // qui ont deja quitte l'etat brouillon.
  const openedBefore = await prisma.event.count({
    where: { ownerId: userId, state: { not: 'DRAFT' } },
  });
  if (openedBefore >= FREE_TIER.events) {
    const payment = await prisma.payment.findUnique({ where: { eventId } });
    if (payment?.state !== 'PAID') {
      throw new AppError('PAYMENT_REQUIRED', 402, 'Cet evenement doit etre regle avant son ouverture');
    }
  }

  return prisma.event.update({ where: { id: eventId }, data: { state: 'OPEN' } });
}

/**
 * Ferme la prise de vue. A partir de cet instant l'album n'est accessible
 * qu'a l'hote et a ses co-hotes, et le compte a rebours de trente jours
 * avant suppression demarre.
 */
export async function closeEvent(eventId: string, userId: string) {
  const { event } = await assertCanManage(eventId, userId);
  if (event.state !== 'OPEN') throw new AppError('NOT_OPEN', 409, "Cet evenement n'est pas ouvert");

  return prisma.event.update({
    where: { id: eventId },
    data: { state: 'CLOSED', closesAt: new Date() },
  });
}

/**
 * Cree les tables de la salle et leurs jetons de QR code.
 * Chaque jeton est tire au hasard : connaitre celui d'une table ne permet
 * pas de deduire les autres.
 */
export async function createTables(eventId: string, userId: string, labels: string[]) {
  await assertCanManage(eventId, userId);
  if (labels.length > MAX_GUESTS_PER_EVENT) {
    throw new AppError('TOO_MANY_TABLES', 422, 'Nombre de tables trop eleve');
  }

  await prisma.eventTable.createMany({
    data: labels.map((label) => ({ eventId, label, qrToken: buildToken(8) })),
  });

  return prisma.eventTable.findMany({
    where: { eventId },
    select: { id: true, label: true, qrToken: true },
  });
}
