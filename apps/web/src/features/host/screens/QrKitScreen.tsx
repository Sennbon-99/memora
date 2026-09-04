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
import {
  eventApi, publicAppOrigin, remettreFichier, tableApi, type ApiError,
} from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { QrCode } from '../../../ui/QrCode.js';
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
  // Le kit imprime peut manquer : oublie a la maison, mouille, ou simplement
  // pas encore sorti de l'imprimante. L'hote a alors le sien dans la poche.
  const [montrer, setMontrer] = useState(false);
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

  // Le telechargement est une mutation comme une autre : il peut echouer, et
  // l'API compose le PDF a la demande — plusieurs secondes pour une affiche A2
  // pendant lesquelles le bouton doit dire ce qu'il fait.
  const kit = useMutation({
    mutationFn: () => eventApi.qrKit(eventId, choisies),
    onSuccess: remettreFichier,
  });

  if (isPending || !data) return <Spinner label="Préparation du kit" />;
  const { event } = data;
  const tableTotal = tables.data?.tables.length ?? event.tables?.length ?? 0;
  const needsTables = event.useTableCodes && choisies.includes('cartes') && tableTotal === 0;

  return (
    <Screen
      title="Votre kit est prêt"
      subtitle={event.useTableCodes
        ? `Un QR code par table pour ${event.name}, plus une affiche pour l’entrée.`
        : `Un QR code commun pour ${event.name}, décliné sur les supports à imprimer.`}
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: 'À IMPRIMER',
        hautDroite: 'KIT QR',
        basDroite: event.state === 'DRAFT' ? 'BROUILLON' : 'OUVERTE',
      }}
      footer={
        <div className="flex flex-col gap-3">
          {/* Le PDF est genere par l'API, pas ici, et recupere avec l'en-tete
              d'authentification : la route est derriere requireAuth. */}
          {/* Le bouton compte : « Télécharger 3 fichiers » confirme la
              sélection au lieu de la faire oublier. */}
          <Button
            full
            disabled={choisies.length === 0 || kit.isPending || needsTables}
            onClick={() => kit.mutate()}
          >
            {kit.isPending
              ? 'Composition du fichier…'
              : choisies.length === 1
                ? 'Télécharger 1 fichier'
                : `Télécharger ${choisies.length} fichiers`}
          </Button>

          {/* Le kit est le seul objet physique du produit : un refus muet ici
              laisse l'hote arriver a sa soiree sans rien a poser sur les
              tables. */}
          {kit.error && (
            <div role="alert" className="rounded-carte bg-danger-doux p-3 text-sm leading-relaxed
              text-danger">
              {(kit.error as ApiError).message}
            </div>
          )}

          {needsTables && (
            <p className="text-center text-xs leading-relaxed text-warn">
              Créez vos tables plus bas avant de télécharger les cartes de table.
            </p>
          )}

          {event.state === 'DRAFT' && event.role === 'OWNER' ? (
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

          {event.state === 'DRAFT' && event.role === 'CO_HOST' && (
            <p className="text-center text-xs leading-relaxed text-ink-3">
              Le kit peut déjà être imprimé. L’organisateur ouvrira ensuite la pellicule.
            </p>
          )}

          {/* Un refus du serveur doit se voir. Sans ce message, le bouton
              parait simplement ne rien faire. */}
          {open.error && (
            <div role="alert" className="rounded-carte bg-danger-doux p-3 text-sm leading-relaxed
              text-danger">
              {(open.error as ApiError).message}
            </div>
          )}
        </div>
      }
    >
      <div className="mt-2">

      <section className="mt-6 rounded-carte bg-pap-2 p-5 shadow-[var(--ombre-tirage)]">
        <p className="font-mono text-etiquette uppercase tracking-[0.16em] text-ink-3">
          Accès sans QR
        </p>
        <p className="mt-2 font-mono text-grand font-semibold tracking-[0.18em] text-a1">
          {event.joinCode}
        </p>
        <p className="mt-2 text-note leading-relaxed text-ink-2">
          Ce code est imprimé sous chaque QR. Un invité peut le saisir depuis
          « Rejoindre une soirée » si son appareil ne parvient pas à scanner.
        </p>
        <Button tone="ghost" full className="mt-4" onClick={() => setMontrer(true)}>
          Afficher le QR code
        </Button>
        <p className="mt-2 text-mini leading-relaxed text-ink-3">
          Pour dépanner sur place : votre écran se scanne aussi bien que le papier.
        </p>
      </section>

      {/* Le meme geste que le partage entre invites : on tend l'ecran, l'autre
          scanne. Presente en tirage, bord blanc epais, parce que c'est ce
          contraste-la dont un appareil photo a besoin — voir QrCode.tsx. */}
      {montrer && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6
            bg-pap px-8 safe-top safe-bottom"
          role="dialog"
          aria-modal="true"
          aria-label="QR code de la soirée"
        >
          <p className="text-center text-lecture leading-relaxed text-ink-2">
            Faites scanner cet écran. Votre invité rejoint la soirée
            avec ses propres {event.quotaShots} poses.
          </p>
          <div className="bg-white p-3 shadow-2xl">
            <QrCode
              value={`${publicAppOrigin()}/e/${event.slug}`}
              size={216}
              label={`Code de la soirée ${event.name}`}
            />
            <p className="mt-2 text-center font-mono text-sm font-bold tracking-[0.2em] text-black">
              {event.joinCode}
            </p>
          </div>
          <Button tone="ghost" onClick={() => setMontrer(false)}>
            Fermer
          </Button>
        </div>
      )}

      <section className="mt-6 w-full">
        <h2 className="px-1 font-mono text-etiquette uppercase tracking-[0.16em] text-ink-3">
          Ce que vous imprimez
        </h2>
        <p className="mt-2 px-1 text-note leading-relaxed text-ink-2">
          L’affiche se pose à l’entrée, les cartes sur les tables. Chaque pièce
          est un fichier : cochez celles dont vous avez besoin.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {KIT_PIECES.map((piece) => {
            const info = KIT_PIECE_INFO[piece];
            const cochee = choisies.includes(piece);
            const pages = piece === 'cartes' && event.useTableCodes
              ? (tableTotal > 0 ? `${tableTotal} pages` : 'tables à créer')
              : '1 page';
            return (
              <li key={piece}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={cochee}
                  onClick={() => basculer(piece)}
                  className={`flex w-full items-start gap-3 rounded-carte border px-3.5 py-3
                    text-left transition active:bg-appui
                    ${cochee ? 'border-a1' : 'border-edge-2'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-champ
                      border text-mini font-bold
                      ${cochee
                        ? 'border-a1 bg-a1 text-on-a1'
                        : 'border-edge'}`}
                  >
                    {cochee ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-corps font-semibold">{info.label}</span>
                    {/* Le format et le nombre de pages sont annonces avant le
                        telechargement : sans eux, l'hote decouvre huit cartes
                        A5 quand il attendait une affiche. */}
                    <span className="mt-0.5 block font-mono text-etiquette uppercase
                      tracking-[0.1em] text-ink-3">
                      {info.format} · QR {info.qrMm} mm · {pages}
                    </span>
                    <span className="mt-1 block text-petit leading-snug text-ink-3">
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
            <h2 className="px-1 font-mono text-etiquette uppercase tracking-[0.16em] text-ink-3">
              Vos tables
            </h2>
            <p className="mt-2 px-1 text-note leading-relaxed text-ink-2">
              Vous demandez le numéro de table à vos invités. Créez-les ici :
              chacune reçoit son propre QR code dans le kit.
            </p>

            {tableTotal > 0 ? (
              <p role="status" className="mt-4 rounded-champ border border-ok
                bg-ok-doux px-4 py-3 text-sm text-ok">
                <span className="font-mono tabular-nums">{tableTotal}</span> tables
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
                  <span className="ml-auto font-mono text-etiquette uppercase tracking-[0.16em]
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
