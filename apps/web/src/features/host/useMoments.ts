// apps/web/src/features/host/useMoments.ts
// Les moments forts d'une soiree.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMomentInput } from '@memora/types';
import { momentApi, type Moment } from '../../lib/api.js';

export const momentsKey = (eventId: string) => ['host', 'moments', eventId] as const;

/**
 * Les moments, rafraichis pendant qu'une fenetre est ouverte.
 *
 * Le decompte se fait cote client, mais la fin reelle est decidee par le
 * serveur : sans ce rappel, un moment expire resterait affiche comme actif
 * sur le telephone de l'hote.
 */
export function useMoments(eventId: string) {
  const query = useQuery({
    queryKey: momentsKey(eventId),
    queryFn: () => momentApi.list(eventId),
    enabled: !!eventId,
  });

  const running = (query.data?.moments ?? []).some((moment) => moment.active);
  return { ...query, refetchInterval: running ? 15_000 : false };
}

export function useMomentActions(eventId: string) {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: momentsKey(eventId) });

  return {
    create: useMutation({
      mutationFn: (input: CreateMomentInput) => momentApi.create(eventId, input),
      onSuccess: refresh,
    }),
    trigger: useMutation({
      mutationFn: (momentId: string) => momentApi.trigger(eventId, momentId),
      onSuccess: refresh,
    }),
    close: useMutation({
      mutationFn: (momentId: string) => momentApi.close(eventId, momentId),
      onSuccess: refresh,
    }),
  };
}

/**
 * Secondes restantes avant la fin d'une fenetre.
 * Nul quand le moment n'a pas commence ou qu'il est deja termine.
 */
export function secondsLeft(moment: Moment, now = Date.now()): number | null {
  if (!moment.startedAt) return null;
  const end = new Date(moment.startedAt).getTime() + moment.durationMinutes * 60_000;
  const left = Math.floor((end - now) / 1000);
  return left > 0 ? left : null;
}

/** Decompte lisible : « 7 min 20 » plutot que « 440 s ». */
export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${String(rest).padStart(2, '0')}`;
}
