// apps/web/src/features/host/useRolls.ts
// Les pellicules d'une soiree, et leur tri.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rollApi } from '../../lib/api.js';

export const rollsKey = (eventId: string) => ['host', 'rolls', eventId] as const;
export const rollPhotosKey = (eventId: string, rollId: string) =>
  ['host', 'roll-photos', eventId, rollId] as const;

/** Les photographies d'une pellicule, pour l'ecran de tri. */
export function useRollPhotos(eventId: string, rollId: string) {
  return useQuery({
    queryKey: rollPhotosKey(eventId, rollId),
    queryFn: () => rollApi.photos(eventId, rollId),
    enabled: !!eventId && !!rollId,
    // Le tri est une session de travail : on ne veut pas qu'un
    // rafraichissement de fond remplace la liste sous le pouce de l'hote.
    staleTime: Infinity,
  });
}

export function useRolls(eventId: string) {
  return useQuery({
    queryKey: rollsKey(eventId),
    queryFn: () => rollApi.list(eventId),
    enabled: !!eventId,
  });
}

/** Cloture le tri d'une pellicule. Les photographies non citees sont gardees. */
export function useReviewRoll(eventId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ rollId, hiddenPhotoIds }: { rollId: string; hiddenPhotoIds: string[] }) =>
      rollApi.review(eventId, rollId, hiddenPhotoIds),
    onSuccess: () => void client.invalidateQueries({ queryKey: rollsKey(eventId) }),
  });
}

/** Avancement du tri, tel qu'affiche en tete de l'onglet Invites. */
export function reviewProgress(rolls: { reviewed: boolean }[]) {
  const done = rolls.filter((roll) => roll.reviewed).length;
  return { done, total: rolls.length, percent: rolls.length ? (done / rolls.length) * 100 : 0 };
}
