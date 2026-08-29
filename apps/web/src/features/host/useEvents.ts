// apps/web/src/features/host/useEvents.ts
// Evenements de l'hote.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEventInput } from '@memora/types';
import { eventApi } from '../../lib/api.js';

export const eventsKey = ['host', 'events'] as const;
export const eventKey = (id: string) => ['host', 'event', id] as const;
export const statsKey = (id: string) => ['host', 'stats', id] as const;

export function useEvents() {
  return useQuery({ queryKey: eventsKey, queryFn: eventApi.list });
}

export function useEvent(id: string) {
  return useQuery({ queryKey: eventKey(id), queryFn: () => eventApi.detail(id), enabled: !!id });
}

/**
 * Statistiques du tableau de bord.
 *
 * Rafraichies toutes les vingt secondes tant que l'onglet est visible. Le
 * temps reel passe par Socket.io ; ce rappel n'est qu'un filet, pour l'hote
 * qui revient sur l'application apres une heure de danse.
 */
export function useStats(id: string) {
  return useQuery({
    queryKey: statsKey(id),
    queryFn: () => eventApi.stats(id),
    enabled: !!id,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
}

export function useCreateEvent() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEventInput) => eventApi.create(input),
    onSuccess: () => void client.invalidateQueries({ queryKey: eventsKey }),
  });
}

/** Modification d'un reglage. Le serveur reste l'autorite sur ce qui est permis. */
export function useUpdateEvent(id: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      eventApi.update(id, patch as Partial<CreateEventInput>),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: eventKey(id) });
      void client.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

/** Ouverture et fermeture de la pellicule, depuis le tableau de bord. */
export function useEventState(id: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: eventKey(id) });
    void client.invalidateQueries({ queryKey: eventsKey });
  };

  return {
    open: useMutation({ mutationFn: () => eventApi.open(id), onSuccess: refresh }),
    close: useMutation({ mutationFn: () => eventApi.close(id), onSuccess: refresh }),
  };
}
