// apps/web/src/features/guest/useGuestSession.ts
// Etat de la pellicule de l'invite.
//
// Une seule requete au serveur : GET /api/e/:slug. Le cookie d'appareil,
// pose par cette meme requete, suffit ensuite a tout le reste. C'est ce qui
// permet a l'invite de fermer son navigateur et de revenir sans rien ressaisir.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import type { JoinEventInput } from '@memora/types';
import { guestApi, type GuestSession } from '../../lib/api.js';
import { applyCarnet } from '../../lib/theme.js';

export const sessionKey = (slug: string) => ['guest-session', slug] as const;

/**
 * Charge la pellicule, et pose la couleur de l'evenement des qu'elle arrive.
 *
 * staleTime a l'infini : le quota n'est jamais rafraichi par une requete de
 * fond, il est mis a jour par les reponses de reservation. Un rafraichissement
 * automatique pourrait ecraser un decompte local pris hors ligne.
 */
export function useGuestSession(slug: string, tableToken?: string, enabled = true) {
  const query = useQuery({
    queryKey: sessionKey(slug),
    queryFn: () => guestApi.join(slug, tableToken),
    enabled,
    staleTime: Infinity,
    retry: 1,
  });

  // Le carnet de la soiree. Tant que le serveur ne l'envoie pas, applyCarnet
  // retombe sur celui de la marque : la page reste habillee, jamais nue.
  const carnet = query.data?.event.carnet;
  useEffect(() => {
    applyCarnet(carnet);
    return () => { applyCarnet('papier'); };
  }, [carnet]);

  return query;
}

/** Modifie la pellicule en cache sans repasser par le serveur. */
export function useUpdateSession(slug: string) {
  const client = useQueryClient();

  return useCallback((patch: (previous: GuestSession) => GuestSession) => {
    client.setQueryData<GuestSession>(sessionKey(slug), (previous) =>
      previous ? patch(previous) : previous,
    );
  }, [client, slug]);
}

/** Acceptation du droit a l'image. Sans elle, aucune pose n'est possible. */
export function useConsent(slug: string) {
  const update = useUpdateSession(slug);

  return useMutation({
    // Le schema partage impose z.literal(true) : accepter est la seule chose
    // que cette route sait faire. Le refus a la sienne, voir useDecline.
    mutationFn: () => guestApi.consent(slug, { accepted: true }),
    onSuccess: () =>
      update((previous) => ({ ...previous, roll: { ...previous.roll, hasConsented: true } })),
  });
}

/**
 * Refus du droit a l'image.
 *
 * Le serveur supprime la pellicule et efface le cookie d'appareil. On vide
 * ensuite le cache : sans cela, l'ecran continuerait d'afficher une session
 * qui n'existe plus, et un retour en arriere la ferait reapparaitre.
 */
export function useDecline(slug: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => guestApi.decline(slug),
    onSuccess: () => client.removeQueries({ queryKey: sessionKey(slug) }),
  });
}

/** Prenom et table, tous deux facultatifs : l'invite peut rester anonyme. */
export function useIdentity(slug: string) {
  const update = useUpdateSession(slug);

  return useMutation({
    mutationFn: (input: JoinEventInput) => guestApi.identity(slug, input),
    onSuccess: (result) =>
      update((previous) => ({
        ...previous,
        roll: { ...previous.roll, firstName: result.firstName },
      })),
  });
}
