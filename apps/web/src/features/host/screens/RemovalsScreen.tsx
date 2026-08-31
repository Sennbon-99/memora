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
import { Photo } from '../../../ui/Photo.js';

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
        <p className="mt-14 text-center text-sm leading-relaxed text-ink-3">
          Aucune demande.<br />C’est plutôt bon signe.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-6 pb-6">
          {pending.map((request) => (
            <article key={request.id} className="overflow-hidden rounded-carte border
              border-a1 bg-pap-2">
              <Photo
                src={request.photo.url}
                alt={`Photographie du ${dateFr(request.photo.takenAt)}`}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
                  Demandé le {dateFr(request.createdAt)}
                </p>
                <p className="mt-1.5 text-[12px] text-ink-2">{requesterLabel(request)}</p>
                <p className="mt-3 text-sm italic leading-relaxed text-ink-2">
                  « {request.reason} »
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handle.mutate({ id: request.id, accept: false })}
                    disabled={handle.isPending}
                    className="h-11 flex-1 rounded-champ border border-edge bg-pap-2
                      text-[13px] font-semibold transition active:bg-appui"
                  >
                    Conserver
                  </button>
                  <button
                    onClick={() => handle.mutate({ id: request.id, accept: true })}
                    disabled={handle.isPending}
                    className="h-11 flex-[1.3] rounded-champ bg-a1 text-[13px]
                      font-bold text-on-a1"
                  >
                    {handle.isPending ? 'Un instant…' : 'Effacer la photo'}
                  </button>
                </div>
              </div>
            </article>
          ))}

          {handled.length > 0 && (
            <section>
              <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
                Déjà traitées
              </h2>
              <ul className="mt-1 flex flex-col">
                {handled.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center gap-3 border-b border-edge-2 px-1 py-2.5
                      last:border-b-0"
                  >
                    <Photo
                      src={request.photo.url}
                      alt=""
                      className={`h-10 w-10 shrink-0 rounded-champ object-cover
                        ${request.state === 'ACCEPTED' ? 'opacity-30 grayscale' : ''}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-ink-2">
                        {requesterLabel(request)}
                      </span>
                      <span className="block text-[10px] text-ink-3">
                        {request.handledAt ? dateFr(request.handledAt) : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold
                      ${request.state === 'ACCEPTED'
                        ? 'bg-pap-2 text-ink-3'
                        : 'bg-ok-doux text-ok'}`}>
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
        className="mt-2 pb-4 text-center text-xs text-ink-3"
      >
        ‹ Retour aux réglages
      </button>
    </Screen>
  );
}
