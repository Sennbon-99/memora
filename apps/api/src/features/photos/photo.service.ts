// apps/api/src/features/photos/photo.service.ts
// Le trajet d'une photographie, de l'appui sur le declencheur jusqu'a son
// enregistrement. C'est la fonctionnalite mise en avant dans le dossier :
// elle traverse l'interface, le metier, l'acces aux donnees, le stockage
// objet et la conformite RGPD.
//
// Le principe qui gouverne tout le fichier : la reservation est une operation
// metier transactionnelle, le transfert est une operation de flux confiee au
// stockage objet. L'API autorise, puis elle constate. Le fichier ne transite
// jamais par ici.

import { randomUUID } from 'node:crypto';
import type { ReservePhotoInput } from '@memora/types';
import { prisma } from '../../config/prisma.js';
import { consumeShot, refundShot } from '../../config/redis.js';
import { buildObjectKey, signUpload, signRead } from '../../config/storage.js';
import type { GuestRoll } from '../../middlewares/requireGuest.js';
import {
  AppError,
  EventClosedError,
  NotFoundError,
  QuotaExhaustedError,
} from '../../utils/errors.js';

/**
 * Delai de grace apres la fermeture, pendant lequel les photographies prises
 * hors connexion peuvent encore remonter. Sans lui, un invite qui a
 * photographie a 02h55 sans reseau perdrait ses images en retrouvant du
 * signal a 03h05.
 */
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;

/**
 * Decide si une photographie peut encore etre deposee.
 *
 * Deux cas l'autorisent : l'evenement est ouvert, ou il vient d'etre ferme
 * et la photographie a ete prise AVANT la fermeture, dans la limite du delai
 * de grace. C'est l'horodatage de la prise de vue qui fait foi, jamais celui
 * de l'envoi : une photographie prise a temps reste valable.
 */
export function acceptsPhotos(
  event: { state: string; closesAt: Date },
  takenAt: Date,
): boolean {
  if (event.state === 'OPEN') return true;
  if (event.state !== 'CLOSED') return false;

  const takenBeforeClosing = takenAt.getTime() <= event.closesAt.getTime();
  const withinGrace = Date.now() <= event.closesAt.getTime() + GRACE_PERIOD_MS;
  return takenBeforeClosing && withinGrace;
}

export interface Reservation {
  photoId: string;
  uploadUrl: string;
  shotsLeft: number;
  bonusShots: number;
  fromBonus: boolean;
}

/**
 * Cherche le moment fort en cours sur un evenement.
 * Un moment est actif s'il a ete declenche et que sa fenetre n'est pas expiree.
 * Les photographies prises pendant cette fenetre lui sont rattachees, ce qui
 * donne a l'hote un album deja decoupe en chapitres.
 */
async function findActiveMoment(eventId: string): Promise<string | null> {
  const moments = await prisma.moment.findMany({
    where: { eventId, startedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
    take: 1,
    select: { id: true, startedAt: true, durationMinutes: true },
  });

  const moment = moments[0];
  if (!moment?.startedAt) return null;

  const endsAt = moment.startedAt.getTime() + moment.durationMinutes * 60_000;
  return Date.now() < endsAt ? moment.id : null;
}

/**
 * Reserve une pose et prepare le depot d'une photographie.
 *
 * L'idempotence repose sur une cle fournie par le client : un rejeu de la
 * meme requete renvoie la reservation existante, sans consommer de pose
 * supplementaire ni creer de doublon. C'est ce qui rend la reprise reseau
 * du mode hors connexion inoffensive.
 */
export async function reserveShot(
  roll: GuestRoll,
  input: ReservePhotoInput,
): Promise<Reservation> {
  // 1. Rejeu detecte : on renvoie la reservation deja creee, avec une
  //    nouvelle adresse signee puisque la precedente a pu expirer.
  const existing = await prisma.photo.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, objectKey: true, rollId: true },
  });
  if (existing) {
    if (existing.rollId !== roll.id) {
      // Une cle appartenant a une autre pellicule est une tentative de rejeu
      // croise : on refuse plutot que de laisser deviner qu'elle existe.
      throw new AppError('IDEMPOTENCY_CONFLICT', 409, 'Clé déjà utilisée');
    }
    return {
      photoId: existing.id,
      uploadUrl: await signUpload(existing.objectKey),
      shotsLeft: roll.shotsLeft,
      bonusShots: roll.bonusShots,
      fromBonus: false,
    };
  }

  // 2. L'evenement accepte-t-il encore des photographies ? La verification
  //    est ici et non dans un middleware, car elle doit etre faite au plus
  //    pres du decrement.
  const event = await prisma.event.findUnique({
    where: { id: roll.eventId },
    select: { id: true, state: true, closesAt: true },
  });
  if (!event) throw new NotFoundError('Événement');
  if (!acceptsPhotos(event, input.takenAt)) throw new EventClosedError();

  // 3. Decrement atomique. Les poses bonus sont consommees en premier.
  const { remaining, fromBonus } = await consumeShot(roll.id);
  if (remaining < 0) throw new QuotaExhaustedError();

  try {
    const objectKey = buildObjectKey(event.id, roll.id, randomUUID());
    const momentId = await findActiveMoment(event.id);

    // 4. Creation de l'enregistrement et report du compteur dans la meme
    //    transaction : soit les deux reussissent, soit aucun des deux.
    const photo = await prisma.$transaction(async (tx) => {
      if (!fromBonus) {
        await tx.roll.update({
          where: { id: roll.id },
          data: { shotsLeft: remaining },
        });
      }
      return tx.photo.create({
        data: {
          objectKey,
          idempotencyKey: input.idempotencyKey,
          takenAt: input.takenAt,
          width: input.width,
          height: input.height,
          sizeBytes: input.sizeBytes,
          rollId: roll.id,
          momentId,
          status: 'RESERVED',
        },
        select: { id: true },
      });
    });

    return {
      photoId: photo.id,
      uploadUrl: await signUpload(objectKey),
      shotsLeft: fromBonus ? roll.shotsLeft : remaining,
      bonusShots: fromBonus ? remaining : 0,
      fromBonus,
    };
  } catch (err) {
    // La pose a ete decrementee mais l'enregistrement a echoue : on la rend,
    // sinon l'invite perdrait une pose sans avoir de photographie.
    await refundShot(roll.id, fromBonus);
    throw err;
  }
}

/**
 * Confirme que le transfert vers le stockage a abouti.
 * Tant que cette confirmation n'arrive pas, la photographie reste a l'etat
 * RESERVED : la pose est consommee, mais le fichier n'est pas garanti present.
 */
export async function confirmUpload(roll: GuestRoll, idempotencyKey: string) {
  const photo = await prisma.photo.findUnique({
    where: { idempotencyKey },
    select: { id: true, rollId: true, status: true },
  });
  if (!photo || photo.rollId !== roll.id) throw new NotFoundError('Photographie');

  // Une confirmation rejouee ne fait rien de plus : elle est idempotente aussi.
  if (photo.status !== 'RESERVED') return { photoId: photo.id, status: photo.status };

  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: { status: 'UPLOADED', uploadedAt: new Date() },
    select: { id: true, status: true },
  });
  return { photoId: updated.id, status: updated.status };
}

/**
 * Les photographies visibles par l'invite, une fois l'album publie.
 * L'organisateur choisit : album collectif, ou pellicule personnelle.
 */
export async function listOwnPhotos(roll: GuestRoll) {
  const event = await prisma.event.findUnique({
    where: { id: roll.eventId },
    select: { state: true, scope: true },
  });
  if (!event) throw new NotFoundError('Événement');
  if (event.state !== 'PUBLISHED') {
    throw new AppError('NOT_PUBLISHED', 409, "L'album n'a pas encore été publié");
  }
  if (event.scope !== 'EVERYONE' && event.scope !== 'OWN_ONLY') {
    throw new AppError('NOT_SHARED', 403, "L'organisateur n'a pas partagé cet album avec les invités");
  }

  const photos = await prisma.photo.findMany({
    where: {
      ...(event.scope === 'OWN_ONLY'
        ? { rollId: roll.id }
        : { roll: { eventId: roll.eventId } }),
      published: true,
      status: 'UPLOADED',
    },
    orderBy: { takenAt: 'asc' },
    select: { id: true, objectKey: true, takenAt: true, width: true, height: true },
  });

  // Chaque adresse est signee individuellement et expire au bout de quinze
  // minutes : une adresse partagee hors de l'application devient inutilisable.
  const signed = await Promise.all(
    photos.map(async ({ objectKey, ...photo }) => ({
      ...photo,
      url: await signRead(objectKey),
    })),
  );
  return { scope: event.scope, photos: signed };
}

/**
 * Demande de retrait d'une photographie, au titre du droit a l'image.
 * Le masquage est immediat et conservatoire : la photographie disparait pour
 * tous les tiers avant meme que l'hote ait tranche.
 */
export async function requestRemoval(roll: GuestRoll, photoId: string, reason: string) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, roll: { select: { eventId: true } } },
  });
  if (!photo || photo.roll.eventId !== roll.eventId) throw new NotFoundError('Photographie');

  const [request] = await prisma.$transaction([
    prisma.removalRequest.create({
      data: { photoId, rollId: roll.id, reason },
      select: { id: true, state: true, createdAt: true },
    }),
    prisma.photo.update({ where: { id: photoId }, data: { status: 'HIDDEN' } }),
  ]);

  return request;
}
