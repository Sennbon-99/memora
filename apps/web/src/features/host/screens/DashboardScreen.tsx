// apps/web/src/features/host/screens/DashboardScreen.tsx
// Tableau de bord de la soiree.
//
// Ce n'est pas une vitrine de chiffres, c'est une liste de choses a faire.
// Quatre compteurs pour situer, puis les actions du moment, dans l'ordre ou
// elles pressent. Le tri arrive en tete : c'est le seul vrai travail.

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../../../lib/api.js';
import { connect, joinEventRoom } from '../../../lib/socket.js';
import { applyEventTheme } from '../../../lib/theme.js';
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

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 px-3.5 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
      {note && <p className="text-[11px] text-[var(--accent)]">{note}</p>}
    </div>
  );
}

function Action({ title, note, cta, onClick }: {
  title: string; note: string; cta: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/10
        bg-white/4 px-4 py-3.5 text-left transition active:bg-white/8"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{title}</span>
        <span className="block truncate text-[11px] text-white/45">{note}</span>
      </span>
      <span className="whitespace-nowrap text-[11px] font-bold text-[var(--accent)]">{cta}</span>
    </button>
  );
}

export function DashboardScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();

  const { data: eventData, isPending } = useEvent(eventId);
  const { data: stats } = useStats(eventId);
  const { open, close } = useEventState(eventId);

  const color = eventData?.event.color;
  useEffect(() => { if (color) applyEventTheme(color); }, [color]);

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
      footer={
        <div className="flex flex-col gap-3">
          {event.state === 'DRAFT' ? (
            <Button full disabled={open.isPending} onClick={() => open.mutate()}>
              {open.isPending ? 'Ouverture…' : 'Ouvrir la pellicule'}
            </Button>
          ) : live ? (
            <Button tone="ghost" full disabled={close.isPending} onClick={() => close.mutate()}>
              {close.isPending ? 'Fermeture…' : 'Fermer la pellicule maintenant'}
            </Button>
          ) : (
            <Button full onClick={() => navigate(`/hote/${eventId}/invites`)}>
              Trier les photographies
            </Button>
          )}

          {failure && (
            <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm leading-relaxed text-red-300">
              {failure.code === 'PAYMENT_REQUIRED'
                ? 'Votre première soirée est offerte. Celle-ci doit être réglée avant d’ouvrir la pellicule.'
                : failure.message}
            </p>
          )}
        </div>
      }
    >
      <p className="mt-2 flex items-center gap-2 text-xs text-white/50">
        {live && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.2)]"
            aria-hidden="true"
          />
        )}
        {stateSentence(event.state, stats?.closesInMinutes ?? 0)}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Stat label="Invités" value={stats?.activeGuests ?? '—'} />
        <Stat label="Photos" value={stats?.totalPhotos ?? '—'} />
        <Stat
          label="Vues utilisées"
          value={stats ? `${stats.quotaUsedPercent} %` : '—'}
          note={`${event.quotaShots} vues par invité`}
        />
        <Stat label="Tables" value={stats?.byTable.length ?? '—'} />
      </div>

      <div className="mt-4 flex flex-col gap-2 pb-6">
        <Action
          title="Trier les photographies"
          note="Une pellicule d’invité à la fois"
          cta="Trier →"
          onClick={() => navigate(`/hote/${eventId}/invites`)}
        />
        <Action
          title="Moments forts"
          note={
            stats?.topMoments.find((m) => m.active)
              ? `${stats.topMoments.find((m) => m.active)!.label} en cours`
              : `${stats?.topMoments.length ?? 0} moments préparés`
          }
          cta="Ouvrir →"
          onClick={() => navigate(`/hote/${eventId}/moments`)}
        />
        <Action
          title="Kit QR"
          note="À imprimer et poser sur les tables"
          cta="Ouvrir →"
          onClick={() => navigate(`/hote/${eventId}/kit`)}
        />
        <Action
          title="Réglages de la soirée"
          note={`${event.quotaShots} poses · ${event.useTableCodes ? 'avec' : 'sans'} numéros de table`}
          cta="Ouvrir →"
          onClick={() => navigate(`/hote/${eventId}/reglages`)}
        />
      </div>

      {stats && stats.byTable.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4 pb-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/45">
            Photos par table
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {stats.byTable.slice(0, 5).map((row) => (
              <li key={row.label} className="flex items-center gap-3 pb-1 text-xs">
                <span className="w-16 shrink-0 truncate text-white/60">{row.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <span
                    className="block h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(row.photos / stats.byTable[0]!.photos) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right font-mono tabular-nums text-white/45">
                  {row.photos}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Screen>
  );
}
