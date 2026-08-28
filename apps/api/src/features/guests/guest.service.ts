// apps/api/src/features/guests/guest.service.ts
// Le parcours de l'invite : rejoindre un evenement, consentir, s'identifier.
//
// Rappel du principe : la pellicule represente un APPAREIL pour un evenement,
// pas une personne. Aucun compte, aucune adresse electronique, un prenom
// facultatif. C'est la traduction directe de la minimisation des donnees.

import type { JoinEventInput, RecoveryCodeInput } from '@memora/types';
import { MAX_GUESTS_PER_EVENT } from '@memora/types';
import { prisma } from '../../config/prisma.js';
import { initQuota, readQuota } from '../../config/redis.js';
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
    shotsLeft: number;
    bonusShots: number;
    hasConsented: boolean;
  };
  event: {
    name: string;
    quotaShots: number;
    previewMode: string;
    color: string;
    welcomeMessage: string | null;
    closesAt: Date;
    useTableCodes: boolean;
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
  slug: string,
  existingToken: string | undefined,
): Promise<GuestSession> {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true, name: true, state: true, quotaShots: true, previewMode: true,
      color: true, welcomeMessage: true, closesAt: true, useTableCodes: true,
      _count: { select: { rolls: true } },
    },
  });
  if (!event) throw new NotFoundError('Evenement');
  if (event.state === 'DRAFT') throw new NotFoundError('Evenement');
  if (event.state !== 'OPEN') throw new EventClosedError();

  // 1. Cet appareil a-t-il deja une pellicule sur cet evenement ?
  const decoded = existingToken ? verifyDeviceToken(existingToken) : null;
  if (decoded) {
    const existing = await prisma.roll.findFirst({
      where: { id: decoded.rollId, eventId: event.id },
    });
    if (existing) {
      // On lit le quota dans Redis, qui fait foi pendant l'evenement.
      const live = await readQuota(existing.id);
      return buildSession(existingToken!, {
        ...existing,
        shotsLeft: live ?? existing.shotsLeft,
      }, event);
    }
  }

  // 2. Nouvel appareil : on verifie le plafond avant d'ouvrir une pellicule.
  if (event._count.rolls >= MAX_GUESTS_PER_EVENT) throw new EventFullError();

  const roll = await prisma.roll.create({
    data: {
      eventId: event.id,
      deviceToken: buildToken(12),
      shotsLeft: event.quotaShots,
    },
  });
  await initQuota(roll.id, event.quotaShots);

  return buildSession(signDeviceToken(roll.id), roll, event);
}

/** Assemble la reponse envoyee au client. */
function buildSession(
  deviceToken: string,
  roll: { id: string; firstName: string | null; shotsLeft: number; bonusShots: number; consentedAt: Date | null },
  event: GuestSession['event'],
): GuestSession {
  return {
    deviceToken,
    roll: {
      id: roll.id,
      firstName: roll.firstName,
      shotsLeft: roll.shotsLeft,
      bonusShots: roll.bonusShots,
      hasConsented: roll.consentedAt !== null,
    },
    event: {
      name: event.name, quotaShots: event.quotaShots, previewMode: event.previewMode,
      color: event.color, welcomeMessage: event.welcomeMessage,
      closesAt: event.closesAt, useTableCodes: event.useTableCodes,
    },
  };
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
  if (!event) throw new NotFoundError('Evenement');

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
  throw new AppError('RECOVERY_FAILED', 401, 'Prenom ou code incorrect');
}
