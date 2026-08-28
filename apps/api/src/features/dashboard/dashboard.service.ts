// apps/api/src/features/dashboard/dashboard.service.ts
// Suivi de la participation en direct.
//
// L'hote regarde son telephone entre deux discours : il doit comprendre en
// trois secondes si ses invites photographient ou non. Le tableau de bord
// ne repond qu'a cette question.

import { prisma } from '../../config/prisma.js';
import { assertCanManage } from '../events/event.service.js';

export interface DashboardStats {
  activeGuests: number;
  totalPhotos: number;
  quotaUsedPercent: number;
  closesInMinutes: number | null;
  byTable: { label: string; guests: number; photos: number }[];
  topMoments: { label: string; photos: number; active: boolean }[];
}

/** Calcule le taux de consommation global du quota. */
function computeUsage(rolls: { shotsLeft: number }[], quotaShots: number): number {
  if (rolls.length === 0) return 0;
  const total = rolls.length * quotaShots;
  const left = rolls.reduce((sum, roll) => sum + roll.shotsLeft, 0);
  return Math.round(((total - left) / total) * 100);
}

/**
 * Statistiques d'un evenement.
 *
 * Une seule requete par agregat plutot qu'une boucle : pour deux cents
 * pellicules, compter les photographies une par une multiplierait les
 * allers-retours avec la base alors que l'hote rafraichit son ecran
 * toutes les quelques secondes.
 */
export async function getStats(eventId: string, userId: string): Promise<DashboardStats> {
  const { event } = await assertCanManage(eventId, userId);

  const [rolls, totalPhotos, tables, moments] = await Promise.all([
    prisma.roll.findMany({
      where: { eventId },
      select: { id: true, shotsLeft: true, tableId: true, isPhotographer: true },
    }),
    prisma.photo.count({ where: { roll: { eventId }, status: 'UPLOADED' } }),
    prisma.eventTable.findMany({
      where: { eventId },
      orderBy: { label: 'asc' },
      select: { id: true, label: true, _count: { select: { rolls: true } } },
    }),
    prisma.moment.findMany({
      where: { eventId },
      select: {
        label: true, startedAt: true, durationMinutes: true,
        _count: { select: { photos: true } },
      },
    }),
  ]);

  // Le photographe officiel est exclu des statistiques d'invites : ses
  // centaines de photographies ecraseraient toutes les autres colonnes.
  const guests = rolls.filter((roll) => !roll.isPhotographer);

  const photosByTable = await Promise.all(
    tables.map(async (table) => ({
      label: table.label,
      guests: table._count.rolls,
      photos: await prisma.photo.count({
        where: { roll: { tableId: table.id }, status: 'UPLOADED' },
      }),
    })),
  );

  const closesInMinutes =
    event.state === 'OPEN'
      ? Math.max(0, Math.round((event.closesAt.getTime() - Date.now()) / 60_000))
      : null;

  return {
    activeGuests: guests.length,
    totalPhotos,
    quotaUsedPercent: computeUsage(guests, event.quotaShots),
    closesInMinutes,
    byTable: photosByTable.sort((a, b) => b.photos - a.photos),
    topMoments: moments
      .map((moment) => ({
        label: moment.label,
        photos: moment._count.photos,
        active:
          moment.startedAt !== null &&
          Date.now() < moment.startedAt.getTime() + moment.durationMinutes * 60_000,
      }))
      .sort((a, b) => b.photos - a.photos),
  };
}
