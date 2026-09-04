// apps/api/src/features/events/event.service.ts
// Regles metier de l'evenement : creation, configuration, ouverture, fermeture.

import type { CreateEventInput, UpdateEventInput } from '@memora/types';
import { MAX_GUESTS_PER_EVENT, CARNET_PAR_TYPE } from '@memora/types';
import { prisma } from '../../config/prisma.js';
import { buildEventSlug, buildJoinCode, buildToken } from '../../utils/slug.js';
import { compact } from '../../utils/object.js';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors.js';

/**
 * Verifie que l'utilisateur a le droit d'agir sur cet evenement.
 * C'est la matrice des roles de la partie 2.1.4.b du dossier, appliquee
 * cote serveur. L'interface se contente de masquer ce qui n'est pas permis :
 * elle n'est jamais l'autorite.
 */
export async function assertCanManage(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      coHosts: { where: { userId }, select: { userId: true } },
      tables: { select: { id: true, label: true }, orderBy: { label: 'asc' } },
    },
  });
  if (!event) throw new NotFoundError('Événement');

  const isOwner = event.ownerId === userId;
  const isCoHost = event.coHosts.length > 0;
  if (!isOwner && !isCoHost) throw new ForbiddenError('Cet événement ne vous appartient pas');

  return { event, isOwner };
}

/** Cree un evenement a l'etat brouillon. Aucun invite ne peut le rejoindre. */
export async function createEvent(userId: string, input: CreateEventInput) {
  const event = await prisma.event.create({
    data: {
      ...compact(input),
      slug: buildEventSlug(input.name),
      joinCode: buildJoinCode(),
      ownerId: userId,
      // Le carnet du type de soiree, sauf si l'hote en a deja choisi un.
      // L'ecran de choix confirme un defaut, il ne le reclame jamais : une
      // soiree est habillee des sa creation.
      carnet: input.carnet ?? CARNET_PAR_TYPE[input.type],
    },
  });
  return { ...event, role: 'OWNER' as const };
}

/**
 * Liste les evenements dont l'utilisateur est hote ou co-hote.
 *
 * Le nombre de photographies demande un second passage : une photographie
 * appartient a une pellicule, pas directement a un evenement, donc Prisma ne
 * sait pas la compter depuis Event. On aurait pu poser un eventId sur Photo,
 * mais dupliquer une cle etrangere pour economiser une requete de liste est
 * un mauvais echange : ce chiffre s'affiche sur une poignee d'evenements,
 * jamais dans une boucle.
 */
export async function listEvents(userId: string) {
  const events = await prisma.event.findMany({
    where: { OR: [{ ownerId: userId }, { coHosts: { some: { userId } } }] },
    orderBy: { eventDate: 'desc' },
    select: {
      id: true, name: true, slug: true, joinCode: true, type: true, eventDate: true,
      state: true, quotaShots: true, closesAt: true, color: true, carnet: true,
      previewMode: true, photoShape: true, welcomeMessage: true, useTableCodes: true,
      ownerId: true,
      _count: { select: { rolls: true } },
    },
  });
  if (events.length === 0) return [];

  // Une seule requete pour tous les evenements, groupee par pellicule, puis
  // repartie en memoire. Compter evenement par evenement ferait N requetes.
  const rolls = await prisma.roll.findMany({
    where: { eventId: { in: events.map((event) => event.id) } },
    select: { eventId: true, _count: { select: { photos: true } } },
  });

  const photosByEvent = new Map<string, number>();
  for (const roll of rolls) {
    photosByEvent.set(roll.eventId, (photosByEvent.get(roll.eventId) ?? 0) + roll._count.photos);
  }

  return events.map(({ ownerId, ...event }) => ({
    ...event,
    role: ownerId === userId ? 'OWNER' as const : 'CO_HOST' as const,
    _count: { ...event._count, photos: photosByEvent.get(event.id) ?? 0 },
  }));
}

/** Detail d'un evenement, pour l'espace de l'hote. */
export async function getEvent(eventId: string, userId: string) {
  const { event, isOwner } = await assertCanManage(eventId, userId);
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    joinCode: event.joinCode,
    type: event.type,
    eventDate: event.eventDate,
    quotaShots: event.quotaShots,
    closesAt: event.closesAt,
    previewMode: event.previewMode,
    photoShape: event.photoShape,
    carnet: event.carnet,
    color: event.color,
    welcomeMessage: event.welcomeMessage,
    useTableCodes: event.useTableCodes,
    state: event.state,
    scope: event.scope,
    tables: event.tables ?? [],
    role: isOwner ? 'OWNER' as const : 'CO_HOST' as const,
  };
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

  return prisma.event.update({ where: { id: eventId }, data: compact(input) });
}

/**
 * Ouvre l'evenement : les invites peuvent desormais scanner et photographier.
 * La V1 ne porte aucun verrou de paiement : tous les evenements sont ouverts.
 */
export async function openEvent(eventId: string, userId: string) {
  const { event, isOwner } = await assertCanManage(eventId, userId);
  if (!isOwner) throw new ForbiddenError("Seul l'organisateur peut ouvrir l'événement");
  if (event.state !== 'DRAFT') throw new AppError('ALREADY_OPEN', 409, 'Cet événement est déjà ouvert');

  return prisma.event.update({ where: { id: eventId }, data: { state: 'OPEN' } });
}

/**
 * Ferme la prise de vue. A partir de cet instant l'album n'est accessible
 * qu'a l'hote et a ses co-hotes, et le compte a rebours de trente jours
 * avant suppression demarre.
 */
export async function closeEvent(eventId: string, userId: string) {
  const { event, isOwner } = await assertCanManage(eventId, userId);
  if (!isOwner) throw new ForbiddenError("Seul l'organisateur peut fermer l'événement");
  if (event.state !== 'OPEN') throw new AppError('NOT_OPEN', 409, "Cet événement n'est pas ouvert");

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
    throw new AppError('TOO_MANY_TABLES', 422, 'Nombre de tables trop élevé');
  }

  await prisma.eventTable.createMany({
    data: labels.map((label) => ({ eventId, label, qrToken: buildToken(8) })),
  });

  return prisma.eventTable.findMany({
    where: { eventId },
    select: { id: true, label: true, qrToken: true },
  });
}
