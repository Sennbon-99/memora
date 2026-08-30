// apps/web/src/features/host/screens/RemovalsScreen.tsx
// Les demandes de retrait.
//
// Ce n'est pas une fonction de confort : c'est le droit d'opposition du
// RGPD, et le dossier l'annonce. Un invite doit pouvoir faire disparaitre
// une photographie de lui, et l'hote doit pouvoir repondre sans apprendre
// qui a demande.
//
// Deux partis pris. La photographie est montree : juger une demande sans
// voir l'image n'a pas de sens. Et l'acceptation ne demande pas de
// confirmation, parce qu'un retrait accepte par erreur est reparable —
// alors qu'un refus laisse une image en ligne contre la volonte de
// quelqu'un.
//
// Deux densites, donc : une demande en attente est un dossier a juger, avec
// son image ; une demande traitee est une ligne d'archive.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { removalApi, type RemovalRequest } from '../../../lib/api.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';

export const removalsKey = (eventId: string) => ['host', 'removals', eventId] as const;

/** Qui a demande, dit sans en apprendre plus que necessaire. */
export function requesterLabel(request: RemovalRequest): string {
  if (request.firstName && request.tableLabel) {
    return `${request.firstName} · ${request.tableLabel}`;
  }
  if (request.firstName) return request.firstName;
  if (request.tableLabel) return `Invité anonyme · ${request.tableLabel}`;
  return 'Invité anonyme';
}

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export function RemovalsScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: removalsKey(eventId),
    queryFn: () => removalApi.list(eventId),
    enabled: !!eventId,
  });

  const handle = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      removalApi.handle(id, accept),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: removalsKey(eventId) });
      void client.invalidateQueries({ queryKey: ['host', 'rolls', eventId] });
    },
  });

  if (isPending || !data) return <Spinner label="Chargement des demandes" />;

  const pending = data.removals.filter((request) => request.state === 'PENDING');
  const handled = data.removals.filter((request) => request.state !== 'PENDING');

  return (
    <Screen
      title="Demandes de retrait"
      subtitle="Un invité peut demander qu’une photographie de lui soit effacée. C’est un droit, pas une faveur."
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${pending.length} EN ATTENTE`,
        hautDroite: 'RETRAITS',
        basDroite: `${handled.length} TRAITÉES`,
      }}
    >
      {data.removals.length === 0 ? (
        <p className="mt-14 text-center text-sm leading-relaxed text-paper/45">
          Aucune demande.<br />C’est plutôt bon signe.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-6 pb-6">
          {pending.map((request) => (
            <article key={request.id} className="overflow-hidden rounded-xl border
              border-gold/35 bg-paper/4">
              <img
                src={request.photo.url}
                alt={`Photographie du ${dateFr(request.photo.takenAt)}`}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/40">
                  Demandé le {dateFr(request.createdAt)}
                </p>
                <p className="mt-1.5 text-[12px] text-paper/55">{requesterLabel(request)}</p>
                <p className="mt-3 text-sm italic leading-relaxed text-paper/75">
                  « {request.reason} »
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handle.mutate({ id: request.id, accept: false })}
                    disabled={handle.isPending}
                    className="h-11 flex-1 rounded-lg border border-gold/18 bg-paper/6
                      text-[13px] font-semibold transition active:bg-paper/10"
                  >
                    Conserver
                  </button>
                  <button
                    onClick={() => handle.mutate({ id: request.id, accept: true })}
                    disabled={handle.isPending}
                    className="h-11 flex-[1.3] rounded-lg bg-[var(--accent)] text-[13px]
                      font-bold text-[var(--accent-text)]"
                  >
                    {handle.isPending ? 'Un instant…' : 'Effacer la photo'}
                  </button>
                </div>
              </div>
            </article>
          ))}

          {handled.length > 0 && (
            <section>
              <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/40">
                Déjà traitées
              </h2>
              <ul className="mt-1 flex flex-col">
                {handled.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center gap-3 border-b border-gold/12 px-1 py-2.5
                      last:border-b-0"
                  >
                    <img
                      src={request.photo.url}
                      alt=""
                      className={`h-10 w-10 shrink-0 rounded-lg object-cover
                        ${request.state === 'ACCEPTED' ? 'opacity-30 grayscale' : ''}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-paper/60">
                        {requesterLabel(request)}
                      </span>
                      <span className="block text-[10px] text-paper/35">
                        {request.handledAt ? dateFr(request.handledAt) : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold
                      ${request.state === 'ACCEPTED'
                        ? 'bg-paper/8 text-paper/50'
                        : 'bg-emerald-500/12 text-emerald-400'}`}>
                      {request.state === 'ACCEPTED' ? 'effacée' : 'conservée'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <button
        onClick={() => navigate(`/hote/${eventId}/reglages`)}
        className="mt-2 pb-4 text-center text-xs text-paper/35"
      >
        ‹ Retour aux réglages
      </button>
    </Screen>
  );
}
