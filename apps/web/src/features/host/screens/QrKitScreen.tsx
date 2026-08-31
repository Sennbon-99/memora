// apps/web/src/features/host/screens/QrKitScreen.tsx
// Le kit de QR codes, juste apres la creation.
//
// C'est le seul objet physique du produit. Tout le reste est immateriel :
// si l'hote n'imprime pas ce kit, aucun invite ne peut entrer.

import { useState } from 'react';
import {
  KIT_PIECES, KIT_PIECES_PAR_DEFAUT, KIT_PIECE_INFO, type KitPiece,
} from '@memora/types';
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
  // Les trois pieces essentielles sont cochees d'avance : un hote presse
  // appuie une fois et a tout ce qu'il lui faut. Les autres sont visibles et
  // non cochees — elles se decouvrent au lieu de se chercher dans un menu.
  const [choisies, setChoisies] = useState<KitPiece[]>(KIT_PIECES_PAR_DEFAUT);
  const basculer = (piece: KitPiece) =>
    setChoisies((actuelles) => actuelles.includes(piece)
      ? actuelles.filter((p) => p !== piece)
      : KIT_PIECES.filter((p) => p === piece || actuelles.includes(p)));

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
          {/* Le bouton compte : « Télécharger 3 fichiers » confirme la
              sélection au lieu de la faire oublier. */}
          <Button
            full
            disabled={choisies.length === 0}
            onClick={() => window.open(eventApi.qrKitUrl(eventId, choisies), '_blank')}
          >
            {choisies.length === 1
              ? 'Télécharger 1 fichier'
              : `Télécharger ${choisies.length} fichiers`}
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
      <div className="mt-2">

      <section className="mt-6 w-full">
        <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/40">
          Ce que vous imprimez
        </h2>
        <p className="mt-2 px-1 text-[13px] leading-relaxed text-paper/55">
          L’affiche se pose à l’entrée, les cartes sur les tables. Chaque pièce
          est un fichier : cochez celles dont vous avez besoin.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {KIT_PIECES.map((piece) => {
            const info = KIT_PIECE_INFO[piece];
            const cochee = choisies.includes(piece);
            const pages = piece === 'cartes' && event.useTableCodes
              ? `${tables.data?.tables.length ?? count} pages`
              : '1 page';
            return (
              <li key={piece}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={cochee}
                  onClick={() => basculer(piece)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3
                    text-left transition active:bg-paper/6
                    ${cochee ? 'border-gold/40' : 'border-gold/12'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[4px]
                      border text-[11px] font-bold
                      ${cochee
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]'
                        : 'border-gold/30'}`}
                  >
                    {cochee ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">{info.label}</span>
                    {/* Le format et le nombre de pages sont annonces avant le
                        telechargement : sans eux, l'hote decouvre huit cartes
                        A5 quand il attendait une affiche. */}
                    <span className="mt-0.5 block font-mono text-[9.5px] uppercase
                      tracking-[0.1em] text-paper/40">
                      {info.format} · QR {info.qrMm} mm · {pages}
                    </span>
                    <span className="mt-1 block text-[12px] leading-snug text-paper/45">
                      {info.note}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

        {event.useTableCodes && (
          <section className="w-full">
            <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/40">
              Vos tables
            </h2>
            <p className="mt-2 px-1 text-[13px] leading-relaxed text-paper/55">
              Vous demandez le numéro de table à vos invités. Créez-les ici :
              chacune reçoit son propre QR code dans le kit.
            </p>

            {tables.isSuccess ? (
              <p role="status" className="mt-4 rounded-lg border border-emerald-500/25
                bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                <span className="font-mono tabular-nums">{tables.data.tables.length}</span> tables
                {' '}créées.
              </p>
            ) : (
              <>
                {/* Le nombre est un chiffre : mono, en or, entre ses deux
                    boutons. Le libelle passe en petites capitales. */}
                <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-gold/18
                  bg-paper/4 px-3.5 py-3">
                  <button
                    onClick={() => setCount((value) => Math.max(1, value - 1))}
                    aria-label="Une table de moins"
                    className="h-11 w-11 rounded-lg bg-paper/8 text-xl active:bg-paper/14"
                  >−</button>
                  <b className="min-w-12 text-center font-mono text-2xl font-medium
                    tabular-nums text-gold">{count}</b>
                  <button
                    onClick={() => setCount((value) => Math.min(40, value + 1))}
                    aria-label="Une table de plus"
                    className="h-11 w-11 rounded-lg bg-paper/8 text-xl active:bg-paper/14"
                  >+</button>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em]
                    text-paper/40">Tables</span>
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
                  <p role="alert" className="mt-2 text-sm text-red-300">
                    {(tables.error as ApiError).message}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {event.state === 'DRAFT' && (
          <p className="rounded-lg border border-gold/25 bg-gold/8 px-4 py-3 text-xs
            leading-relaxed text-gold">
            La pellicule est encore fermée. Ouvrez-la le jour J : avant, un
            invité qui scanne verra que la soirée n’a pas commencé.
          </p>
        )}
      </div>
    </Screen>
  );
}
