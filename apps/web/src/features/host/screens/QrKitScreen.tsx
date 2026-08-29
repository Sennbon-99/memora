// apps/web/src/features/host/screens/QrKitScreen.tsx
// Le kit de QR codes, juste apres la creation.
//
// C'est le seul objet physique du produit. Tout le reste est immateriel :
// si l'hote n'imprime pas ce kit, aucun invite ne peut entrer.

import { useNavigate, useParams } from 'react-router-dom';
import { eventApi, type ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useEvent, useEventState } from '../useEvents.js';

export function QrKitScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending } = useEvent(eventId);
  const { open } = useEventState(eventId);

  if (isPending || !data) return <Spinner label="Préparation du kit" />;
  const { event } = data;

  return (
    <Screen
      title="Votre kit est prêt"
      subtitle={`Un QR code par table pour ${event.name}, plus une affiche pour l’entrée.`}
      footer={
        <div className="flex flex-col gap-3">
          {/* Telechargement direct : le PDF est genere par l'API, pas ici. */}
          <Button full onClick={() => window.open(eventApi.qrKitUrl(eventId), '_blank')}>
            Télécharger le kit à imprimer
          </Button>

          {event.state === 'DRAFT' ? (
            <Button
              tone="ghost"
              full
              disabled={open.isPending}
              onClick={() => open.mutate(undefined, {
                onSuccess: () => navigate(`/hote/${eventId}`),
              })}
            >
              {open.isPending ? 'Ouverture…' : 'Ouvrir la pellicule maintenant'}
            </Button>
          ) : (
            <Button tone="ghost" full onClick={() => navigate(`/hote/${eventId}`)}>
              Aller au tableau de bord
            </Button>
          )}

          {/* Un refus du serveur doit se voir. Sans ce message, le bouton
              paraissait simplement ne rien faire — c'est le cas d'une soiree
              au-dela du palier gratuit, refusee avec un 402. */}
          {open.error && (
            <div role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm leading-relaxed
              text-red-300">
              {(open.error as ApiError).code === 'PAYMENT_REQUIRED' ? (
                <>
                  Votre première soirée est offerte. Celle-ci doit être réglée
                  avant d’ouvrir la pellicule.
                  <button
                    onClick={() => navigate(`/hote/${eventId}/facturation`)}
                    className="mt-2 block font-bold underline"
                  >
                    Régler cette soirée
                  </button>
                </>
              ) : (open.error as ApiError).message}
            </div>
          )}
        </div>
      }
    >
      <div className="mt-10 flex flex-col items-center gap-6">
        {/* Apercu decoratif : le vrai QR code est dans le PDF, genere par le
            serveur avec le bon niveau de correction d'erreur. */}
        <div className="grid h-44 w-44 place-items-center rounded-3xl bg-paper" aria-hidden="true">
          <div
            className="h-32 w-32"
            style={{
              background:
                'conic-gradient(#17110A 0 25%, transparent 0 50%, #17110A 0 75%, transparent 0),' +
                'conic-gradient(#17110A 0 25%, transparent 0 50%, #17110A 0 75%, transparent 0) 8px 8px',
              backgroundSize: '20px 20px, 12px 12px',
            }}
          />
        </div>

        <p className="max-w-xs text-center text-sm leading-relaxed text-white/50">
          Imprimez, posez sur les tables. Aucun invité n’aura à télécharger
          quoi que ce soit : le QR code ouvre directement sa pellicule.
        </p>

        {event.state === 'DRAFT' && (
          <p className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)]
            px-4 py-3 text-xs leading-relaxed text-[#E8C79A]">
            La pellicule est encore fermée. Ouvrez-la le jour J : avant, un
            invité qui scanne verra que la soirée n’a pas commencé.
          </p>
        )}
      </div>
    </Screen>
  );
}
