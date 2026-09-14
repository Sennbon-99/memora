// apps/web/src/features/host/screens/DashboardScreen.tsx
// Tableau de bord de la soiree.
//
// Ce n'est pas une vitrine de chiffres, c'est une liste de choses a faire.
// Quatre compteurs pour situer, puis les actions du moment, dans l'ordre ou
// elles pressent. Le tri arrive en tete : c'est le seul vrai travail.
//
// Trois densites, trois formes. Les chiffres forment une plaque compacte,
// comme le dos d'une boite de pellicule. Les actions sont des rangees nues
// separees par un filet. Le releve par table est une liste. Quand tout est
// une carte grise arrondie, plus rien n'a de rang.

import { useEffect, useState } from 'react';
import { ConfirmSheet } from '../../../ui/ConfirmSheet.js';
import { Icon, type NomIcone } from '../../../ui/Icon.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../../../lib/api.js';
import { connect, joinEventRoom } from '../../../lib/socket.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { statsKey, useEvent, useEventState, useStats } from '../useEvents.js';

/**
 * Etat de la soiree en une phrase, dite comme l'hote la vivrait.
 *
 * Le cas qui a motive cette fonction : un evenement encore OPEN dont l'heure
 * de fermeture est passee, parce que la tache planifiee ne l'a pas encore
 * traite. Ecrire « En cours, pellicule fermee » serait une contradiction ;
 * il faut nommer l'etat reel, qui est une fermeture en retard.
 */
export function stateSentence(state: string, closesInMinutes: number): string {
  if (state === 'DRAFT') return 'Brouillon · pellicule pas encore ouverte';
  if (state !== 'OPEN') return 'Pellicule fermée';

  if (closesInMinutes <= 0) return 'En cours · heure de fermeture dépassée';
  if (closesInMinutes < 60) return `En cours · ferme dans ${closesInMinutes} min`;

  const hours = Math.floor(closesInMinutes / 60);
  const rest = closesInMinutes % 60;
  return `En cours · ferme dans ${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`;
}

/** Inscription courte de la bande laterale, pour situer l'etat d'un coup d'oeil. */
function stateCode(state: string): string {
  if (state === 'DRAFT') return 'BROUILLON';
  if (state === 'OPEN') return 'EN COURS';
  if (state === 'PUBLISHED') return 'PUBLIÉE';
  return 'FERMÉE';
}

/**
 * Un chiffre.
 *
 * Le nombre en mono et en or, le libelle en petites capitales espacees. La
 * cellule n'a pas de cadre a elle : les filets viennent de la plaque, sans
 * quoi quatre cadres a quatre pixels de distance donnent une grille de
 * boites au lieu d'un compteur.
 */
function Stat({ label, value, unit, note, edge = '' }: {
  label: string;
  value: number | string;
  /** Unite collee au chiffre, en plus petit : « % » ne se lit pas comme un nombre. */
  unit?: string | undefined;
  note?: string;
  edge?: string;
}) {
  return (
    <div className={`px-5 py-4 ${edge}`}>
      <p className="text-note font-medium text-ink-3">{label}</p>
      <p className="mt-1.5 text-grand leading-none font-semibold tabular-nums text-ink">
        {value}
        {unit && <span className="ml-0.5 align-baseline text-base text-ink-3">{unit}</span>}
      </p>
      {note && <p className="mt-1.5 text-mini leading-tight text-ink-3">{note}</p>}
    </div>
  );
}

/** Une action Studio : un pictogramme, un titre et sa conséquence. */
function Action({ title, note, onClick, icon }: {
  title: string; note: string; onClick: () => void; icon: NomIcone;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-carte bg-pap-2 p-5 text-left shadow-[var(--ombre-tirage)] transition active:bg-appui">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-a-doux text-a1"><Icon nom={icon} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-lecture font-semibold">{title}</span>
        <span className="mt-1 block text-note text-ink-3">{note}</span>
      </span>
      <Icon nom="chevron" taille={16} className="text-ink-3" />
    </button>
  );
}

export function DashboardScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const [confirmClose, setConfirmClose] = useState(false);
  const client = useQueryClient();

  const { data: eventData, isPending } = useEvent(eventId);
  const { data: stats } = useStats(eventId);
  const { open, close } = useEventState(eventId);

  // Chaque photographie confirmee rafraichit les compteurs. Sans cela, l'hote
  // verrait des chiffres vieux de vingt secondes pendant que la salle
  // photographie.
  useEffect(() => {
    if (!eventId) return;
    const socket = connect();
    joinEventRoom(eventId);

    const bump = () => void client.invalidateQueries({ queryKey: statsKey(eventId) });
    socket.on('photo:uploaded', bump);
    return () => { socket.off('photo:uploaded', bump); };
  }, [eventId, client]);

  if (isPending || !eventData) return <Spinner label="Chargement du tableau de bord" />;
  const { event } = eventData;
  const live = event.state === 'OPEN';
  const failure = (open.error ?? close.error) as ApiError | null;

  return (
    <Screen
      title={event.name}
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${event.quotaShots} VUES`,
        hautDroite: 'SOIRÉE',
        basDroite: stateCode(event.state),
      }}
      footer={
        <div className="flex flex-col gap-3">
          {event.state === 'DRAFT' && event.role === 'OWNER' ? (
            <Button full disabled={open.isPending} onClick={() => open.mutate()}>
              {open.isPending ? 'Ouverture…' : 'Ouvrir la pellicule'}
            </Button>
          ) : event.state === 'DRAFT' ? (
            <p className="rounded-carte bg-pap-2 px-4 py-3 text-center text-note text-ink-2">
              L’organisateur ouvrira la pellicule quand la soirée commencera.
            </p>
          ) : live ? (
            <Button full onClick={() => navigate(`/hote/${eventId}/kit`)}>
              <Icon nom="qr" /> Inviter mes proches
            </Button>
          ) : (
            <Button full onClick={() => navigate(`/hote/${eventId}/invites`)}>
              Trier les photographies
            </Button>
          )}

          {failure && (
            <p role="alert" className="rounded-carte bg-danger-doux p-3 text-sm leading-relaxed text-danger">
              {failure.message}
            </p>
          )}
        </div>
      }
    >
      <p className="studio-cover mt-5 flex min-h-24 items-center gap-3 text-note">
        {live && (
          // Une bague de lumiere, pas une ombre portee : sur un fond sombre,
          // seule la clarte se voit.
          <span
            className="h-1.5 w-1.5 rounded-full bg-ok ring-[3px] ring-ok"
            aria-hidden="true"
          />
        )}
        {stateSentence(event.state, stats?.closesInMinutes ?? 0)}
      </p>

      {/* La plaque de chiffres : un seul cadre, des filets a l'interieur. */}
      <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-carte bg-pap-2
        shadow-[var(--ombre-tirage)]">
        <Stat label="Invités" value={stats?.activeGuests ?? '—'} edge="border-b border-r border-edge-2" />
        <Stat label="Photos" value={stats?.totalPhotos ?? '—'} edge="border-b border-edge-2" />
        <Stat
          label="Vues utilisées"
          value={stats?.quotaUsedPercent ?? '—'}
          unit={stats ? '%' : undefined}
          note={`${event.quotaShots} vues par invité`}
          edge="border-r border-edge-2"
        />
        <Stat label="Tables" value={stats?.byTable.length ?? '—'} />
      </div>

      <h2 className="mt-8 px-1 text-note font-medium text-ink-3">
        À faire
      </h2>
      <div className="mt-1 flex flex-col gap-2">
        <Action
          icon="planche"
          title="Trier les photographies"
          note="Une pellicule d’invité à la fois"
          onClick={() => navigate(`/hote/${eventId}/invites`)}
        />
        <Action
          icon="etoile"
          title="Moments forts"
          note={
            stats?.topMoments.find((m) => m.active)
              ? `${stats.topMoments.find((m) => m.active)!.label} en cours`
              : `${stats?.topMoments.length ?? 0} moments préparés`
          }
          onClick={() => navigate(`/hote/${eventId}/moments`)}
        />
        <Action
          icon="qr"
          title="Invitations et QR code"
          note="À imprimer et poser sur les tables"
          onClick={() => navigate(`/hote/${eventId}/kit`)}
        />
        <Action
          icon="crayon"
          title="Réglages de la soirée"
          note={`${event.quotaShots} vues · ${event.useTableCodes ? 'avec' : 'sans'} numéros de table`}
          onClick={() => navigate(`/hote/${eventId}/reglages`)}
        />
      </div>

      {stats && stats.byTable.length > 0 && (
        <section className="mt-8 pb-6">
          <h2 className="px-1 text-note font-medium text-ink-3">
            Photos par table
          </h2>
          <ul className="mt-1 flex flex-col">
            {stats.byTable.slice(0, 5).map((row) => (
              <li
                key={row.label}
                className="flex items-center gap-3 border-b border-edge-2 px-1 py-2.5
                  text-xs last:border-b-0"
              >
                <span className="w-16 shrink-0 truncate text-ink-2">{row.label}</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-pap-2">
                  <span
                    className="block h-full rounded-full bg-a-doux"
                    style={{ width: `${(row.photos / stats.byTable[0]!.photos) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right font-mono tabular-nums text-a1">
                  {row.photos}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {live && event.role === 'OWNER' && (
        <Button tone="danger" full className="my-5" disabled={close.isPending} onClick={() => setConfirmClose(true)}>
          {close.isPending ? 'Fermeture…' : 'Terminer la prise de photos'}
        </Button>
      )}
      <ConfirmSheet
        open={confirmClose}
        title="Fermer la pellicule ?"
        description="Les invités ne pourront plus prendre de nouvelles photos. Les photos déjà prises pourront encore arriver pendant le délai de synchronisation."
        confirmLabel="Fermer la pellicule"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => { setConfirmClose(false); close.mutate(); }}
      />
    </Screen>
  );
}
