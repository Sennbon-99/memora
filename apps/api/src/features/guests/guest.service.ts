// apps/api/src/features/guests/guest.service.ts
// Le parcours de l'invite : rejoindre un evenement, consentir, s'identifier.
//
// Rappel du principe : la pellicule represente un APPAREIL pour un evenement,
// pas une personne. Aucun compte, aucune adresse electronique, un prenom
// facultatif. C'est la traduction directe de la minimisation des donnees.

import type { JoinEventInput, RecoveryCodeInput } from '@memora/types';
import { MAX_GUESTS_PER_EVENT } from '@memora/types';
import { prisma } from '../../config/prisma.js';
import { initQuota, readBonusQuota, readQuota } from '../../config/redis.js';
import { signDeviceToken, verifyDeviceToken } from '../../utils/jwt.js';
import { hashRecoveryCode, verifyRecoveryCode } from '../../utils/hash.js';
import { buildToken } from '../../utils/slug.js';
import {
  AppError,
  EventClosedError,
  EventFullError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors.js';

/** Ce que le client recoit a l'arrivee sur un evenement. */
export interface GuestSession {
  deviceToken: string;
  roll: {
    id: string;
    firstName: string | null;
    tableId: string | null;
    shotsLeft: number;
    bonusShots: number;
    hasConsented: boolean;
  };
  event: {
    id: string;
    slug: string;
    joinCode: string;
    name: string;
    quotaShots: number;
    previewMode: string;
    color: string;
    carnet: string;
    welcomeMessage: string | null;
    closesAt: Date;
    useTableCodes: boolean;
    /**
     * Les tables de la soiree, quand l'hote les demande.
     *
     * Elles sont indispensables : le champ tableId attend l'identifiant
     * d'une table existante, pas un numero saisi a la main. Sans cette
     * liste, l'invite ne pourrait jamais renseigner sa table.
     */
    tables: { id: string; label: string }[];
    /** Etat de la soiree : le client en deduit l'ecran a montrer. */
    state: string;
    /** Regle choisie par l'organisateur pour l'album publie. */
    scope: string;
    /** Vrai des que l'hote a publie : c'est ce qui ouvre l'album. */
    albumPublished: boolean;
  };
}

/**
 * Ouvre une pellicule, ou restaure celle qui existe deja sur cet appareil.
 *
 * Le cookie n'est pas une preuve d'identite : c'est le porteur du quota.
 * Un cookie absent ou invalide n'est donc pas une erreur, c'est simplement
 * un appareil qui arrive pour la premiere fois.
 */
export async function joinEvent(
  identifier: string,
  existingToken: string | undefined,
  tableToken?: string,
): Promise<GuestSession> {
  const shortCode = /^[A-Za-z0-9]{6,8}$/.test(identifier);
  const event = await prisma.event.findUnique({
    where: shortCode
      ? { joinCode: identifier.toUpperCase() }
      : { slug: identifier },
    select: {
      id: true, name: true, slug: true, joinCode: true, state: true, quotaShots: true, previewMode: true,
      color: true, carnet: true, welcomeMessage: true, closesAt: true, useTableCodes: true, scope: true,
      tables: { select: { id: true, label: true, qrToken: true }, orderBy: { label: 'asc' } },
      _count: { select: { rolls: true } },
    },
  });
  if (!event) throw new NotFoundError('Événement');
  // Un evenement en preparation est traite comme inexistant : on ne revele
  // pas qu'une soiree se prepare a quelqu'un qui a devine l'adresse.
  if (event.state === 'DRAFT') throw new NotFoundError('Événement');
  // Une soiree purgee n'a plus rien a montrer : ses photographies sont
  // effacees, et son lien doit se comporter comme un lien mort.
  if (event.state === 'PURGED') throw new EventClosedError();

  const scannedTable = tableToken
    ? (event.tables ?? []).find((table) => table.qrToken === tableToken)
    : undefined;

  // 1. Cet appareil a-t-il deja une pellicule sur cet evenement ?
  //
  // Ce test vient AVANT le refus d'un evenement ferme. Un invite qui revient
  // apres la fin de la soiree doit retrouver sa pellicule : c'est la seule
  // facon pour lui d'attendre la publication, puis de voir son album. Le
  // refus d'ouvrir une pellicule ne concerne que les nouveaux arrivants.
  const decoded = existingToken ? verifyDeviceToken(existingToken) : null;
  if (decoded) {
    const existing = await prisma.roll.findFirst({
      where: { id: decoded.rollId, eventId: event.id },
    });
    if (existing) {
      const restored = existing.tableId === null && scannedTable
        ? await prisma.roll.update({
            where: { id: existing.id },
            data: { tableId: scannedTable.id },
          })
        : existing;
      // On lit le quota dans Redis, qui fait foi pendant l'evenement.
      const [live, liveBonus] = await Promise.all([
        readQuota(existing.id),
        readBonusQuota(existing.id),
      ]);
      return buildSession(existingToken!, {
        ...restored,
        shotsLeft: live ?? existing.shotsLeft,
        bonusShots: liveBonus,
      }, event);
    }
  }

  // 2. Nouvel appareil. Une pellicule ne s'ouvre que pendant la soiree :
  // arriver apres la fermeture, sans cookie, ne donne acces a rien.
  if (event.state !== 'OPEN') throw new EventClosedError();
  if (event._count.rolls >= MAX_GUESTS_PER_EVENT) throw new EventFullError();

  const roll = await prisma.roll.create({
    data: {
      eventId: event.id,
      deviceToken: buildToken(12),
      shotsLeft: event.quotaShots,
      ...(scannedTable ? { tableId: scannedTable.id } : {}),
    },
  });
  await initQuota(roll.id, event.quotaShots);

  return buildSession(signDeviceToken(roll.id), roll, event);
}

/** Assemble la reponse envoyee au client. */
function buildSession(
  deviceToken: string,
  roll: {
    id: string; firstName: string | null; tableId?: string | null;
    shotsLeft: number; bonusShots: number; consentedAt: Date | null;
  },
  event: Omit<GuestSession['event'], 'albumPublished'>,
): GuestSession {
  return {
    deviceToken,
    roll: {
      id: roll.id,
      firstName: roll.firstName,
      tableId: roll.tableId ?? null,
      shotsLeft: roll.shotsLeft,
      bonusShots: roll.bonusShots,
      hasConsented: roll.consentedAt !== null,
    },
    event: {
      id: event.id, slug: event.slug, joinCode: event.joinCode,
      name: event.name, quotaShots: event.quotaShots, previewMode: event.previewMode,
      color: event.color, carnet: event.carnet, welcomeMessage: event.welcomeMessage,
      closesAt: event.closesAt, useTableCodes: event.useTableCodes,
      tables: (event.tables ?? []).map(({ id, label }) => ({ id, label })),
      state: event.state,
      scope: event.scope,
      albumPublished: event.state === 'PUBLISHED',
    },
  };
}

/** Le jeton signe place dans le lien personnel de la pellicule. */
export function createRecoveryLinkToken(rollId: string) {
  return { token: signDeviceToken(rollId) };
}

/**
 * Restaure une pellicule depuis son lien personnel. Le jeton est un secret
 * porteur : il est valide seulement si la pellicule appartient bien a la
 * soiree indiquee dans l'adresse.
 */
export async function recoverFromLink(identifier: string, token: string) {
  const decoded = verifyDeviceToken(token);
  if (!decoded) throw new UnauthorizedError('Lien personnel invalide');

  const shortCode = /^[A-Za-z0-9]{6,8}$/.test(identifier);
  const event = await prisma.event.findUnique({
    where: shortCode
      ? { joinCode: identifier.toUpperCase() }
      : { slug: identifier },
    select: { id: true },
  });
  if (!event) throw new NotFoundError('Événement');

  const roll = await prisma.roll.findFirst({
    where: { id: decoded.rollId, eventId: event.id },
    select: { id: true },
  });
  if (!roll) throw new UnauthorizedError('Lien personnel invalide');

  return { deviceToken: signDeviceToken(roll.id), rollId: roll.id };
}

/**
 * Enregistre le consentement au droit a l'image.
 * Sans lui, aucune photographie ne peut exister : c'est la regle RG-04
 * du dossier, et elle est verifiee a chaque reservation de pose.
 */
export async function giveConsent(rollId: string) {
  const roll = await prisma.roll.findUnique({ where: { id: rollId } });
  if (!roll) throw new UnauthorizedError('Pellicule introuvable');

  // Un consentement deja donne n'est pas redemande, et surtout pas rehorodate :
  // c'est la date du premier accord qui fait foi.
  if (roll.consentedAt) return { consentedAt: roll.consentedAt };

  const updated = await prisma.roll.update({
    where: { id: rollId },
    data: { consentedAt: new Date() },
    select: { consentedAt: true },
  });
  return updated;
}

/** Prenom et table, tous deux facultatifs. */
export async function setIdentity(rollId: string, input: JoinEventInput) {
  if (input.tableId) {
    const roll = await prisma.roll.findUnique({
      where: { id: rollId },
      select: { eventId: true },
    });
    if (!roll) throw new UnauthorizedError('Pellicule introuvable');

    const table = await prisma.eventTable.findFirst({
      where: { id: input.tableId, eventId: roll.eventId },
      select: { id: true },
    });
    if (!table) throw new AppError('INVALID_TABLE', 422, 'Cette table ne fait pas partie de la soirée');
  }

  return prisma.roll.update({
    where: { id: rollId },
    data: { firstName: input.firstName ?? null, tableId: input.tableId ?? null },
    select: { id: true, firstName: true, tableId: true },
  });
}

/**
 * Enregistre le code a quatre chiffres propose en fin de pellicule.
 * Il est hache, jamais stocke en clair : c'est un secret partage, meme court.
 */
export async function saveRecoveryCode(rollId: string, code: string) {
  await prisma.roll.update({
    where: { id: rollId },
    data: { recoveryHash: await hashRecoveryCode(code) },
  });
  return { saved: true };
}

/**
 * Retrouve une pellicule depuis un autre appareil, avec prenom et code.
 * C'est le seul cas ou le code sert : au quotidien, le cookie suffit.
 */
export async function recoverRoll(slug: string, input: RecoveryCodeInput) {
  const event = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
  if (!event) throw new NotFoundError('Événement');

  const candidates = await prisma.roll.findMany({
    where: { eventId: event.id, firstName: input.firstName, recoveryHash: { not: null } },
  });

  // Plusieurs invites peuvent porter le meme prenom : on essaie chaque code.
  for (const roll of candidates) {
    if (await verifyRecoveryCode(input.code, roll.recoveryHash!)) {
      return { deviceToken: signDeviceToken(roll.id), rollId: roll.id };
    }
  }

  // Message unique : il ne dit pas si c'est le prenom ou le code qui est faux.
  throw new AppError('RECOVERY_FAILED', 401, 'Prénom ou code incorrect');
}
