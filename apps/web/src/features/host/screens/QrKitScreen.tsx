// apps/web/src/features/host/screens/QrKitScreen.tsx
// Le kit de QR codes, juste apres la creation.
//
// C'est le seul objet physique du produit. Tout le reste est immateriel :
// si l'hote n'imprime pas ce kit, aucun invite ne peut entrer.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { eventApi, tableApi, type ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useEvent, useEventState } from '../useEvents.js';

export function QrKitScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending } = useEvent(eventId);
  const { open } = useEventState(eventId);
  const client = useQueryClient();
  const [count, setCount] = useState(8);

  // Les tables ne sont pas decoratives : le champ que l'invite remplit
  // attend l'identifiant d'une table existante. Sans elles, la question
  // « quelle table ? » n'a aucune reponse valide.
  const tables = useMutation({
    mutationFn: () => tableApi.create(
      eventId,
      Array.from({ length: count }, (_, index) => `Table ${index + 1}`),
    ),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['host', 'event', eventId] }),
  });

  if (isPending || !data) return <Spinner label="Préparation du kit" />;
  const { event } = data;

  return (
    <Screen
      title="Votre kit est prêt"
      subtitle={`Un QR code par table pour ${event.name}, plus une affiche pour l’entrée.`}
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: 'À IMPRIMER',
        hautDroite: 'KIT QR',
        basDroite: event.state === 'DRAFT' ? 'BROUILLON' : 'OUVERTE',
      }}
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
            <div role="alert" className="rounded-carte bg-danger-doux p-3 text-sm leading-relaxed
              text-danger">
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
        <div className="grid h-44 w-44 place-items-center rounded-carte bg-pap-2" aria-hidden="true">
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

        <p className="max-w-xs text-center text-sm leading-relaxed text-ink-3">
          Imprimez, posez sur les tables. Aucun invité n’aura à télécharger
          quoi que ce soit : le QR code ouvre directement sa pellicule.
        </p>

        {event.useTableCodes && (
          <section className="w-full">
            <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
              Vos tables
            </h2>
            <p className="mt-2 px-1 text-[13px] leading-relaxed text-ink-2">
              Vous demandez le numéro de table à vos invités. Créez-les ici :
              chacune reçoit son propre QR code dans le kit.
            </p>

            {tables.isSuccess ? (
              <p role="status" className="mt-4 rounded-champ border border-ok
                bg-ok-doux px-4 py-3 text-sm text-ok">
                <span className="font-mono tabular-nums">{tables.data.tables.length}</span> tables
                {' '}créées.
              </p>
            ) : (
              <>
                {/* Le nombre est un chiffre : mono, en or, entre ses deux
                    boutons. Le libelle passe en petites capitales. */}
                <div className="mt-4 flex items-center gap-3.5 rounded-carte border border-edge
                  bg-pap-2 px-3.5 py-3">
                  <button
                    onClick={() => setCount((value) => Math.max(1, value - 1))}
                    aria-label="Une table de moins"
                    className="h-11 w-11 rounded-champ bg-pap-2 text-xl active:bg-appui"
                  >−</button>
                  <b className="min-w-12 text-center font-mono text-2xl font-medium
                    tabular-nums text-a1">{count}</b>
                  <button
                    onClick={() => setCount((value) => Math.min(40, value + 1))}
                    aria-label="Une table de plus"
                    className="h-11 w-11 rounded-champ bg-pap-2 text-xl active:bg-appui"
                  >+</button>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em]
                    text-ink-3">Tables</span>
                </div>
                <Button
                  tone="ghost"
                  full
                  className="mt-3"
                  disabled={tables.isPending}
                  onClick={() => tables.mutate()}
                >
                  {tables.isPending ? 'Création…' : 'Créer les tables'}
                </Button>
                {tables.error && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {(tables.error as ApiError).message}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {event.state === 'DRAFT' && (
          <p className="rounded-champ border border-edge bg-a-doux px-4 py-3 text-xs
            leading-relaxed text-a1">
            La pellicule est encore fermée. Ouvrez-la le jour J : avant, un
            invité qui scanne verra que la soirée n’a pas commencé.
          </p>
        )}
      </div>
    </Screen>
  );
}
