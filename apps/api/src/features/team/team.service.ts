// apps/api/src/features/team/team.service.ts
// Les roles delegues par l'hote : co-hotes et photographe officiel.
//
// Deux mecanismes tres differents. Le co-hote est une personne identifiee,
// qui possede un compte et se connecte. Le photographe, lui, recoit un simple
// lien : il n'a pas de compte, mais sa pellicule ignore le quota.

import { prisma } from '../../config/prisma.js';
import { buildToken } from '../../utils/slug.js';
import { signDeviceToken } from '../../utils/jwt.js';
import { assertCanManage } from '../events/event.service.js';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors.js';

/** Quota nominal du photographe. Eleve, mais borne : rien n'est infini. */
const PHOTOGRAPHER_QUOTA = 2000;

/**
 * Invite un co-hote par son adresse electronique.
 *
 * La personne doit deja posseder un compte : on ne cree pas de compte a sa
 * place, ce qui reviendrait a lui imposer une inscription qu'elle n'a pas
 * demandee. Si elle n'en a pas, l'hote lui transmet le lien d'inscription.
 */
export async function inviteCoHost(eventId: string, userId: string, email: string) {
  const { isOwner } = await assertCanManage(eventId, userId);
  if (!isOwner) throw new ForbiddenError("Seul l'hote peut inviter un co-hote");

  const invited = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!invited) {
    throw new AppError('USER_NOT_FOUND', 404, "Cette personne n'a pas encore de compte Memora");
  }
  if (invited.id === userId) {
    throw new AppError('ALREADY_OWNER', 409, 'Vous etes deja l hote de cet evenement');
  }

  const existing = await prisma.coHost.findUnique({
    where: { userId_eventId: { userId: invited.id, eventId } },
  });
  if (existing) throw new AppError('ALREADY_CO_HOST', 409, 'Cette personne est deja co-hote');

  await prisma.coHost.create({ data: { userId: invited.id, eventId } });
  return { user: invited };
}

/** Retire un co-hote. Ses actions passees restent, seul l'acces cesse. */
export async function removeCoHost(eventId: string, userId: string, coHostId: string) {
  const { isOwner } = await assertCanManage(eventId, userId);
  if (!isOwner) throw new ForbiddenError("Seul l'hote peut retirer un co-hote");

  const deleted = await prisma.coHost.deleteMany({
    where: { eventId, userId: coHostId },
  });
  if (deleted.count === 0) throw new NotFoundError('Co-hote');

  return { removed: true };
}

/** La liste des co-hotes d'un evenement. */
export async function listCoHosts(eventId: string, userId: string) {
  await assertCanManage(eventId, userId);

  const coHosts = await prisma.coHost.findMany({
    where: { eventId },
    orderBy: { invitedAt: 'asc' },
    select: { invitedAt: true, user: { select: { id: true, name: true, email: true } } },
  });

  return coHosts.map(({ user, invitedAt }) => ({ ...user, invitedAt }));
}

/**
 * Produit le lien du photographe officiel.
 *
 * Le jeton est distinct du slug public : le photographe ne passe pas par le
 * QR code des invites, et diffuser son lien ne revient pas a diffuser
 * l'acces invite, ni l'inverse.
 */
export async function createPhotographerLink(eventId: string, userId: string) {
  const { event, isOwner } = await assertCanManage(eventId, userId);
  if (!isOwner) throw new ForbiddenError("Seul l'hote peut inviter un photographe");

  const token = event.photographerToken ?? buildToken(16);
  if (!event.photographerToken) {
    await prisma.event.update({ where: { id: eventId }, data: { photographerToken: token } });
  }

  return { token, quota: PHOTOGRAPHER_QUOTA };
}

/**
 * Ouvre la pellicule du photographe a partir de son lien.
 *
 * Elle fonctionne comme celle d'un invite, a deux differences pres : son
 * quota est nominal plutot que contraint, et le consentement est considere
 * comme acquis — le photographe est un professionnel mandate par l'hote,
 * pas un convive.
 */
export async function joinAsPhotographer(photographerToken: string, deviceToken?: string) {
  const event = await prisma.event.findUnique({
    where: { photographerToken },
    // Le slug est rendu au client : sans lui, le photographe ne saurait pas
    // vers quelle adresse aller apres avoir ouvert sa pellicule.
    select: { id: true, name: true, slug: true, state: true, color: true, closesAt: true },
  });
  if (!event) throw new NotFoundError('Evenement');
  if (event.state !== 'OPEN') {
    throw new AppError('EVENT_CLOSED', 409, "La prise de vue est terminee");
  }

  const existing = deviceToken
    ? await prisma.roll.findFirst({ where: { eventId: event.id, isPhotographer: true } })
    : null;

  const roll = existing ?? await prisma.roll.create({
    data: {
      eventId: event.id,
      deviceToken: buildToken(12),
      firstName: 'Photographe',
      isPhotographer: true,
      consentedAt: new Date(),
      shotsLeft: PHOTOGRAPHER_QUOTA,
    },
  });

  return {
    deviceToken: signDeviceToken(roll.id),
    roll: { id: roll.id, shotsLeft: roll.shotsLeft, isPhotographer: true },
    event: { name: event.name, slug: event.slug, color: event.color, closesAt: event.closesAt },
  };
}
