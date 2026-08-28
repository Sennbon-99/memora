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

export interface Reservation {
  photoId: string;
  uploadUrl: string;
  shotsLeft: number;
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
      throw new AppError('IDEMPOTENCY_CONFLICT', 409, 'Cle deja utilisee');
    }
    return {
      photoId: existing.id,
      uploadUrl: await signUpload(existing.objectKey),
      shotsLeft: roll.shotsLeft,
      fromBonus: false,
    };
  }

  // 2. L'evenement est-il toujours ouvert ? La verification est ici et non
  //    dans un middleware, car elle doit etre faite au plus pres du decrement.
  const event = await prisma.event.findUnique({
    where: { id: roll.eventId },
    select: { id: true, state: true, closesAt: true },
  });
  if (!event) throw new NotFoundError('Evenement');
  if (event.state !== 'OPEN') throw new EventClosedError();

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
      shotsLeft: remaining,
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
 * Les photographies de sa propre pellicule, une fois l'album publie.
 * Avant publication, l'invite ne voit rien : c'est le principe du produit.
 */
export async function listOwnPhotos(roll: GuestRoll) {
  const event = await prisma.event.findUnique({
    where: { id: roll.eventId },
    select: { state: true, scope: true },
  });
  if (!event) throw new NotFoundError('Evenement');
  if (event.state !== 'PUBLISHED') {
    throw new AppError('NOT_PUBLISHED', 409, "L'album n'a pas encore ete publie");
  }
  if (event.scope === 'NONE') {
    throw new AppError('NOT_SHARED', 403, "L'hote n'a pas partage cet album");
  }

  const photos = await prisma.photo.findMany({
    where: { rollId: roll.id, published: true, status: 'UPLOADED' },
    orderBy: { takenAt: 'asc' },
    select: { id: true, objectKey: true, takenAt: true, width: true, height: true },
  });

  // Chaque adresse est signee individuellement et expire au bout de quinze
  // minutes : une adresse partagee hors de l'application devient inutilisable.
  return Promise.all(
    photos.map(async ({ objectKey, ...photo }) => ({
      ...photo,
      url: await signRead(objectKey),
    })),
  );
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
