// apps/web/src/features/host/screens/BillingScreen.tsx
// Facturation d'une soiree.
//
// La premiere soiree d'un compte est offerte. Les suivantes se reglent
// avant l'ouverture de la pellicule : c'est le refus en 402 que l'hote
// rencontre s'il essaie d'ouvrir sans payer.
//
// Le paiement lui-meme n'a pas lieu ici : le serveur cree une session
// Stripe et rend une adresse, ou l'hote est redirige. Aucun numero de
// carte ne transite par Memora, ce qui evite toute obligation PCI DSS.

import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { paymentApi, ApiError } from '../../../lib/api.js';
import { FREE_TIER } from '@memora/types';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useEvent } from '../useEvents.js';

export function BillingScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data: eventData } = useEvent(eventId);

  const { data, isPending } = useQuery({
    queryKey: ['host', 'payment', eventId],
    queryFn: () => paymentApi.status(eventId),
    enabled: !!eventId,
    retry: false,
  });

  const checkout = useMutation({
    mutationFn: () => paymentApi.checkout(eventId),
    // On quitte l'application pour la page de paiement : le retour se fait
    // par les adresses de succes et d'annulation configurees cote serveur.
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  if (isPending || !eventData) return <Spinner label="Chargement de la facturation" />;
  const { event } = eventData;

  return (
    <Screen
      title="Facturation"
      subtitle={event.name}
      footer={
        data?.paid ? (
          <Button full tone="ghost" onClick={() => navigate(`/hote/${eventId}`)}>
            Retour à la soirée
          </Button>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Button full disabled={checkout.isPending} onClick={() => checkout.mutate()}>
              {checkout.isPending ? 'Ouverture du paiement…' : 'Régler cette soirée'}
            </Button>
            {checkout.error && (
              <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm leading-relaxed
                text-red-300">
                {(checkout.error as ApiError).message}
              </p>
            )}
          </div>
        )
      }
    >
      <div className="mt-7 flex flex-col gap-4 pb-6">
        {data?.paid ? (
          <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5">
            <p className="text-base font-bold text-emerald-400">Soirée réglée</p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/55">
              Vous pouvez ouvrir la pellicule quand vous le souhaitez.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/4 p-5">
            <p className="text-base font-bold">Cette soirée n’est pas encore réglée</p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/55">
              Votre première soirée est offerte, limitée à {FREE_TIER.shots} poses
              par invité et {FREE_TIER.guests} participants. Au-delà, chaque
              soirée se règle avant l’ouverture de la pellicule.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/40">
            Ce que comprend une soirée
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] text-white/65">
            <li>Jusqu’à 200 invités, sans application à installer</li>
            <li>{event.quotaShots} vues par invité, réglables avant l’ouverture</li>
            <li>Kit de QR codes imprimable</li>
            <li>Album partageable et archive téléchargeable</li>
            <li>Conservation trente jours, puis effacement automatique</li>
          </ul>
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-white/35">
          Le paiement est traité par Stripe. Aucun numéro de carte ne passe
          par Memora, ni n’y est conservé.
        </p>
      </div>
    </Screen>
  );
}
