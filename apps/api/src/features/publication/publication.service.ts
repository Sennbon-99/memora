// apps/api/src/features/publication/publication.service.ts
// Le tri par l'hote, puis la publication de l'album selon une portee choisie.

import type { PublicationScope, PublishEventInput } from '@memora/types';
import { prisma } from '../../config/prisma.js';
import { signRead } from '../../config/storage.js';
import { buildToken } from '../../utils/slug.js';
import { hashRecoveryCode, verifyRecoveryCode } from '../../utils/hash.js';
import { assertCanManage } from '../events/event.service.js';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { filterVisible, type Viewer } from './visibility.js';

/**
 * L'album complet, reserve a l'hote et a ses co-hotes.
 * Il n'est accessible qu'une fois l'evenement ferme : avant, la prise de vue
 * est encore en cours et l'album n'a pas de sens.
 *
 * Les photographies sont groupees par pellicule et par moment fort, ce qui
 * donne a l'hote un album deja decoupe en chapitres pour son tri.
 */
export async function getAlbumForHost(eventId: string, userId: string) {
  const { event } = await assertCanManage(eventId, userId);
  if (event.state === 'DRAFT' || event.state === 'OPEN') {
    throw new AppError('NOT_CLOSED', 409, "L'album n'est disponible qu'après la fermeture");
  }

  const photos = await prisma.photo.findMany({
    where: { roll: { eventId }, status: { in: ['UPLOADED', 'HIDDEN'] } },
    orderBy: [{ takenAt: 'asc' }],
    select: {
      id: true, objectKey: true, takenAt: true, status: true, published: true,
      width: true, height: true,
      roll: { select: { id: true, firstName: true, table: { select: { label: true } } } },
      moment: { select: { id: true, label: true } },
    },
  });

  return Promise.all(
    photos.map(async ({ objectKey, roll, ...photo }) => ({
      ...photo,
      url: await signRead(objectKey),
      // On expose l'identifiant de pellicule et le prenom s'il a ete donne,
      // jamais autre chose : l'invite reste anonyme s'il l'a choisi.
      rollId: roll.id,
      firstName: roll.firstName,
      tableLabel: roll.table?.label ?? null,
    })),
  );
}

/**
 * Publie l'album : marque les photographies retenues, fixe la portee,
 * produit le lien de partage.
 *
 * Le jeton du lien est distinct de l'identifiant de l'evenement. C'est ce qui
 * permet de le revoquer sans toucher a l'evenement, et ce qui empeche de
 * deviner l'adresse d'un album a partir de celle de l'evenement.
 */
export async function publishAlbum(
  eventId: string,
  userId: string,
  input: PublishEventInput,
) {
  const { event } = await assertCanManage(eventId, userId);
  if (event.state === 'DRAFT' || event.state === 'OPEN') {
    throw new AppError('NOT_CLOSED', 409, 'Fermez la prise de vue avant de publier');
  }

  const selected = new Set(input.photoIds);

  const [, , updated] = await prisma.$transaction([
    // On repart d'une ardoise vierge : une photographie retiree de la
    // selection cesse immediatement d'etre accessible.
    prisma.photo.updateMany({
      where: { roll: { eventId } },
      data: { published: false },
    }),
    prisma.photo.updateMany({
      where: { roll: { eventId }, id: { in: [...selected] }, status: 'UPLOADED' },
      data: { published: true },
    }),
    prisma.event.update({
      where: { id: eventId },
      data: {
        state: 'PUBLISHED',
        scope: input.scope,
        albumToken: event.albumToken ?? buildToken(16),
        accessCodeHash: input.accessCode ? await hashRecoveryCode(input.accessCode) : null,
      },
      select: { id: true, scope: true, albumToken: true },
    }),
  ]);

  return {
    scope: updated.scope,
    albumToken: updated.albumToken,
    publishedCount: selected.size,
  };
}

/**
 * Consultation de l'album par son lien de partage.
 *
 * Le controle d'acces se fait en deux temps : d'abord le code, s'il a ete
 * active par l'hote, puis le moteur de visibilite photographie par
 * photographie. Le second ne fait jamais confiance au premier.
 */
export async function getPublicAlbum(
  albumToken: string,
  viewer: Viewer,
  accessCode?: string,
) {
  const event = await prisma.event.findUnique({
    where: { albumToken },
    select: {
      id: true, name: true, color: true, carnet: true, state: true, scope: true,
      accessCodeHash: true,
    },
  });
  if (!event) throw new NotFoundError('Album');

  if (event.accessCodeHash) {
    if (!accessCode) throw new AppError('ACCESS_CODE_REQUIRED', 401, "Cet album est protégé par un code");
    if (!(await verifyRecoveryCode(accessCode, event.accessCodeHash))) {
      throw new ForbiddenError('Code incorrect');
    }
  }

  const photos = await prisma.photo.findMany({
    where: { roll: { eventId: event.id } },
    orderBy: { takenAt: 'asc' },
    select: {
      id: true, objectKey: true, takenAt: true, width: true, height: true,
      published: true, status: true, rollId: true,
    },
  });

  const visible = filterVisible(
    { isPublished: event.state === 'PUBLISHED', scope: event.scope },
    photos.map((p) => ({ ...p, hidden: p.status === 'HIDDEN' || p.status === 'REMOVED' })),
    viewer,
  );

  return {
    event: { name: event.name, color: event.color, carnet: event.carnet },
    photos: await Promise.all(
      visible.map(async ({ objectKey, published: _p, status: _s, hidden: _h, ...photo }) => ({
        ...photo,
        url: await signRead(objectKey),
      })),
    ),
  };
}

/**
 * Arbitrage d'une demande de retrait par l'hote.
 * Accepter retire definitivement, refuser remet la photographie en ligne.
 */
/**
 * Les demandes de retrait d'une soiree.
 *
 * L'invite reste anonyme : on rend son prenom s'il l'a donne, sa table s'il
 * en a une, et rien d'autre. L'hote doit pouvoir repondre a la demande sans
 * apprendre qui l'a faite.
 */
export async function listRemovals(eventId: string, userId: string) {
  await assertCanManage(eventId, userId);

  const requests = await prisma.removalRequest.findMany({
    where: { photo: { roll: { eventId } } },
    orderBy: [{ state: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true, reason: true, state: true, createdAt: true, handledAt: true,
      photo: { select: { id: true, objectKey: true, takenAt: true, status: true } },
      roll: { select: { firstName: true, table: { select: { label: true } } } },
    },
  });

  return Promise.all(requests.map(async ({ photo, roll, ...request }) => ({
    ...request,
    photo: {
      id: photo.id,
      takenAt: photo.takenAt,
      status: photo.status,
      // L'hote doit voir la photographie pour juger : une demande sans
      // image ne lui apprend rien.
      url: await signRead(photo.objectKey),
    },
    firstName: roll.firstName,
    tableLabel: roll.table?.label ?? null,
  })));
}

export async function handleRemoval(
  requestId: string,
  userId: string,
  accept: boolean,
) {
  const request = await prisma.removalRequest.findUnique({
    where: { id: requestId },
    select: { id: true, state: true, photoId: true, photo: { select: { roll: { select: { eventId: true } } } } },
  });
  if (!request) throw new NotFoundError('Demande');
  await assertCanManage(request.photo.roll.eventId, userId);

  if (request.state !== 'PENDING') {
    throw new AppError('ALREADY_HANDLED', 409, 'Cette demande a déjà été traitée');
  }

  const [updated] = await prisma.$transaction([
    prisma.removalRequest.update({
      where: { id: requestId },
      data: { state: accept ? 'ACCEPTED' : 'REFUSED', handledAt: new Date() },
      select: { id: true, state: true },
    }),
    prisma.photo.update({
      where: { id: request.photoId },
      data: { status: accept ? 'REMOVED' : 'UPLOADED' },
    }),
  ]);

  return updated;
}


/**
 * Publie tout ce qui a ete trie, et rien d'autre.
 *
 * C'est la publication au fil de l'eau : l'hote trie une pellicule, la
 * publie, passe a la suivante. Les invites voient l'album grandir au lieu
 * d'attendre que tout soit fini.
 *
 * Le non-choix vaut conservation : une photographie d'une pellicule triee
 * est publiee sauf si l'hote l'a explicitement masquee. Les pellicules pas
 * encore ouvertes restent invisibles — les publier reviendrait a diffuser
 * ce que personne n'a regarde.
 *
 * La portee est choisie une seule fois. Aux appels suivants elle est
 * ignoree : l'invite ne doit pas voir les regles changer en cours de route.
 */
export async function publishReviewed(eventId: string, userId: string, scope?: PublicationScope) {
  const { event } = await assertCanManage(eventId, userId);
  if (event.state === 'DRAFT' || event.state === 'OPEN') {
    throw new AppError('NOT_CLOSED', 409, 'Fermez la prise de vue avant de publier');
  }

  const first = event.state !== 'PUBLISHED';
  if (first && !scope) {
    throw new AppError('SCOPE_REQUIRED', 400, "Choisissez qui pourra voir l'album");
  }

  const [published] = await prisma.$transaction([
    prisma.photo.updateMany({
      where: {
        roll: { eventId, reviewedAt: { not: null } },
        status: 'UPLOADED',
        published: false,
      },
      data: { published: true },
    }),
    prisma.event.update({
      where: { id: eventId },
      data: {
        state: 'PUBLISHED',
        ...(first && scope ? { scope } : {}),
        albumToken: event.albumToken ?? buildToken(16),
      },
    }),
  ]);

  // Reste-t-il des pellicules non triees ? C'est ce qui distingue un album
  // qui grandit d'un album acheve, et donc la notification a envoyer.
  const pending = await prisma.roll.count({
    where: {
      eventId,
      reviewedAt: null,
      photos: { some: { status: { in: ['UPLOADED', 'HIDDEN'] } } },
    },
  });

  return { publishedNow: published.count, first, complete: pending === 0, pending };
}
