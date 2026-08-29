// apps/web/src/features/host/screens/GuestsScreen.tsx
// Onglet Invites : les pellicules, et l'entree du tri.
//
// Trier par pellicule plutot que par heure a une raison precise : une
// pellicule fait au plus vingt-quatre photographies. La tache est bornee,
// elle a une fin visible, et l'hote peut publier apres chacune. Une heure de
// soiree, elle, peut en contenir trois cents.

import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import type { RollSummary } from '../../../lib/api.js';
import { reviewProgress, useRolls } from '../useRolls.js';

/** Initiale affichee dans la pastille, ou un point d'interrogation si anonyme. */
function initial(roll: RollSummary): string {
  return roll.firstName ? roll.firstName.charAt(0).toUpperCase() : '?';
}

/** Sous-titre d'une pellicule : ce qui la situe dans la soiree. */
function subtitle(roll: RollSummary): string {
  const place = roll.tableLabel ?? 'Sans table';
  const count = roll.photos === 0
    ? 'aucune photo'
    : `${roll.photos} photo${roll.photos > 1 ? 's' : ''}`;
  return `${place} · ${count}`;
}

function Badge({ roll }: { roll: RollSummary }) {
  if (roll.pendingRemoval) {
    return <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold text-red-400">retrait</span>;
  }
  if (!roll.reviewed) {
    return <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold text-[var(--accent)]">à trier</span>;
  }
  const kept = roll.photos - roll.hidden;
  return (
    <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400">
      {kept} gardée{kept > 1 ? 's' : ''}
    </span>
  );
}

export function GuestsScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError } = useRolls(eventId);

  if (isPending) return <Spinner label="Chargement des pellicules" />;

  if (isError) {
    return (
      <Screen title="Chargement impossible" subtitle="Vérifiez votre connexion et rechargez la page.">
        <span />
      </Screen>
    );
  }

  const rolls = data.rolls;
  const progress = reviewProgress(rolls);

  return (
    <Screen title="Pellicules" subtitle="Touchez une pellicule pour la trier.">
      {rolls.length === 0 ? (
        <p className="mt-14 text-center text-sm leading-relaxed text-white/45">
          Aucun invité n’a encore scanné le QR code.
        </p>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3 text-[11px] text-white/50">
            <span className="whitespace-nowrap">
              {progress.done} sur {progress.total} triée{progress.total > 1 ? 's' : ''}
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-[var(--accent)] transition-[width]
                  duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${progress.percent}%` }}
              />
            </span>
          </div>

          <ul className="mt-4 flex flex-col gap-2 pb-6">
            {rolls.map((roll, index) => (
              <li
                key={roll.id}
                // Entree en cascade : elle dit que la liste vient d'arriver,
                // et guide le regard du haut vers le bas.
                className="animate-[rise_.34s_cubic-bezier(.2,.8,.2,1)_backwards]
                  motion-reduce:animate-none"
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              >
                <button
                  onClick={() => navigate(`/hote/${eventId}/tri/${roll.id}`)}
                  disabled={roll.photos === 0}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10
                    bg-white/4 px-3 py-2.5 text-left transition active:bg-white/9
                    disabled:opacity-40"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold
                      ${roll.firstName
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-white/7 text-base font-normal text-white/45'}`}
                  >
                    {initial(roll)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">
                      {roll.firstName ?? 'Anonyme'}
                    </span>
                    <span className="block truncate text-[11px] text-white/45">{subtitle(roll)}</span>
                  </span>

                  <Badge roll={roll} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
