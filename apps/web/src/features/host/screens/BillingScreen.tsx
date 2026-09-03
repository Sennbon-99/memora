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
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: data?.paid ? 'RÉGLÉE' : 'À RÉGLER',
        hautDroite: 'FACTURE',
        basDroite: `${event.quotaShots} VUES`,
      }}
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
              <p role="alert" className="rounded-carte bg-danger-doux p-3 text-sm leading-relaxed
                text-danger">
                {(checkout.error as ApiError).message}
              </p>
            )}
          </div>
        )
      }
    >
      <div className="pb-6">
        {data?.paid ? (
          <div className="mt-7 rounded-carte border border-ok bg-ok-doux p-5">
            <p className="text-base font-bold text-ok">Soirée réglée</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              Vous pouvez ouvrir la pellicule quand vous le souhaitez.
            </p>
          </div>
        ) : (
          <div className="mt-7 rounded-carte bg-pap-2 shadow-[var(--ombre-tirage)] p-5">
            <p className="text-base font-bold">Cette soirée n’est pas encore réglée</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              Votre première soirée est offerte, limitée à{' '}
              <span className="font-mono tabular-nums text-a1">{FREE_TIER.shots}</span> vues
              par invité et{' '}
              <span className="font-mono tabular-nums text-a1">{FREE_TIER.guests}</span>{' '}
              participants. Au-delà, chaque soirée se règle avant l’ouverture
              de la pellicule.
            </p>
          </div>
        )}

        {/* Ce qui est compris n'est pas une carte de plus : c'est une liste,
            et une liste se lit en rangees separees par un filet. */}
        <h2 className="mt-8 px-1 font-mono text-etiquette uppercase tracking-[0.16em] text-ink-3">
          Ce que comprend une soirée
        </h2>
        <ul className="mt-1 flex flex-col text-note text-ink-2">
          <li className="border-b border-edge-2 px-1 py-3">
            Jusqu’à <span className="font-mono tabular-nums">200</span> invités,
            sans application à installer
          </li>
          <li className="border-b border-edge-2 px-1 py-3">
            <span className="font-mono tabular-nums text-a1">{event.quotaShots}</span> vues
            par invité, réglables avant l’ouverture
          </li>
          <li className="border-b border-edge-2 px-1 py-3">Kit de QR codes imprimable</li>
          <li className="border-b border-edge-2 px-1 py-3">
            Album partageable et archive téléchargeable
          </li>
          <li className="px-1 py-3">
            Conservation <span className="font-mono tabular-nums">30</span> jours,
            puis effacement automatique
          </li>
        </ul>

        <p className="mt-6 px-1 text-mini leading-relaxed text-ink-3">
          Le paiement est traité par Stripe. Aucun numéro de carte ne passe
          par Memora, ni n’y est conservé.
        </p>
      </div>
    </Screen>
  );
}
