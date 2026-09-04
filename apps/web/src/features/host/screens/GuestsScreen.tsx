// apps/web/src/features/host/screens/GuestsScreen.tsx
// Onglet Invites : les pellicules, et l'entree du tri.
//
// Trier par pellicule plutot que par heure a une raison precise : une
// pellicule fait au plus vingt-quatre photographies. La tache est bornee,
// elle a une fin visible, et l'hote peut publier apres chacune. Une heure de
// soiree, elle, peut en contenir trois cents.
//
// La liste est faite de rangees separees par un filet, non de cartes
// empilees : vingt cartes identiques donnent vingt objets a examiner, vingt
// rangees donnent une seule liste a parcourir.

import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { EmptyState } from '../../../ui/EmptyState.js';
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
    return (
      <span className="shrink-0 rounded-full bg-danger-doux px-2 py-1 text-micro font-bold
        text-danger">retrait</span>
    );
  }
  if (!roll.reviewed) {
    return (
      <span className="shrink-0 rounded-full bg-a-doux px-2 py-1 text-micro font-bold
        text-a1">à trier</span>
    );
  }
  const kept = roll.photos - roll.hidden;
  return (
    <span className="shrink-0 rounded-full bg-ok-doux px-2 py-1 text-micro font-bold
      text-ok">
      <span className="font-mono tabular-nums">{kept}</span> gardée{kept > 1 ? 's' : ''}
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
      <Screen
        title="Chargement impossible"
        subtitle="Vérifiez votre connexion et rechargez la page."
        code={{ hautGauche: 'MEMORA 400', hautDroite: 'INVITÉS' }}
      >
        <span />
      </Screen>
    );
  }

  const rolls = data.rolls;
  const progress = reviewProgress(rolls);

  return (
    <Screen
      title="Pellicules"
      subtitle="Touchez une pellicule pour la trier."
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${rolls.length} PELLICULES`,
        hautDroite: 'INVITÉS',
        basDroite: `${progress.done}/${progress.total} TRIÉES`,
      }}
    >
      {rolls.length === 0 ? (
        <EmptyState>
          Aucun invité n’a encore scanné le QR code.
        </EmptyState>
      ) : (
        <>
          {/* L'avancement du tri est un chiffre, pas une phrase : mono et or,
              libelle en petites capitales. */}
          <div className="mt-6 flex items-center gap-3">
            <span className="whitespace-nowrap font-mono text-mini tabular-nums text-a1">
              {progress.done}/{progress.total}
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-pap-2">
              <span
                className="block h-full rounded-full bg-a1 transition-[width]
                  duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${progress.percent}%` }}
              />
            </span>
            <span className="font-mono text-etiquette uppercase tracking-[0.16em] text-ink-3">
              Triées
            </span>
          </div>

          <ul className="mt-4 flex flex-col pb-6">
            {rolls.map((roll, index) => (
              <li
                key={roll.id}
                // Entree en cascade : elle dit que la liste vient d'arriver,
                // et guide le regard du haut vers le bas.
                className="animate-[rise_.34s_cubic-bezier(.2,.8,.2,1)_backwards]
                  border-b border-edge-2 last:border-b-0 motion-reduce:animate-none"
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              >
                <button
                  onClick={() => navigate(`/hote/${eventId}/tri/${roll.id}`)}
                  disabled={roll.photos === 0}
                  className="flex w-full items-center gap-3 px-1 py-3 text-left transition
                    active:bg-appui disabled:opacity-40"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold
                      ${roll.firstName
                        ? 'bg-a-doux text-a1'
                        : 'bg-pap-2 text-base font-normal text-ink-3'}`}
                  >
                    {initial(roll)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-note font-bold">
                      {roll.firstName ?? 'Anonyme'}
                    </span>
                    <span className="block truncate text-mini text-ink-3">{subtitle(roll)}</span>
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
