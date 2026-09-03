// apps/web/src/features/host/screens/EventListScreen.tsx
// Liste des soirees. Premier ecran apres la connexion.

import { useNavigate } from 'react-router-dom';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useEvents } from '../useEvents.js';
import type { EventSummary } from '../../../lib/api.js';

/** Etat de la soiree, dit avec les mots de l'hote et non ceux de la base. */
function stateLabel(event: EventSummary): { text: string; tone: string } {
  switch (event.state) {
    case 'DRAFT': return { text: 'brouillon', tone: 'bg-pap-2 text-ink-3' };
    case 'OPEN': return { text: 'en cours', tone: 'bg-ok-doux text-ok' };
    case 'CLOSED': return { text: 'à trier', tone: 'bg-a-doux text-a1' };
    case 'PUBLISHED': return { text: 'album publié', tone: 'bg-pap-2 text-ink-3' };
    case 'PURGED': return { text: 'effacée', tone: 'bg-pap-2 text-ink-3' };
  }
}

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function EventListScreen() {
  const navigate = useNavigate();
  const { data, isPending, isError } = useEvents();

  if (isPending) return <Spinner label="Chargement de vos soirées" />;

  if (isError) {
    return (
      <Screen title="Chargement impossible" subtitle="Vérifiez votre connexion et rechargez la page.">
        <span />
      </Screen>
    );
  }

  const events = data.events;

  return (
    <Screen
      title="Vos soirées"
      subtitle="Une pellicule par soirée. Chacune a son QR code et ses vues."
      footer={
        <Button full onClick={() => navigate('/hote/nouvelle')}>
          Créer une soirée
        </Button>
      }
    >
      {events.length === 0 ? (
        <p className="mt-14 text-center text-sm leading-relaxed text-ink-3">
          Rien pour l’instant.<br />Créez votre première soirée, imprimez le kit,
          et vos invités photographient.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3 pb-6">
          {events.map((event) => {
            const badge = stateLabel(event);
            return (
              <li key={event.id}>
                <button
                  onClick={() => navigate(`/hote/${event.id}`)}
                  className="w-full overflow-hidden rounded-carte bg-pap-2 text-left
                    shadow-[var(--ombre-tirage)] transition active:bg-appui"
                >
                  <div className="px-4 py-3.5">
                    {/* La teinte choisie par l'hote sert de reperage entre
                        plusieurs soirees. Elle etait posee en bande de six
                        pixels en haut de la carte : une bande aussi fine ne
                        peut pas epouser un rayon de vingt-quatre, et se
                        detachait en pastille flottante au-dessus du cadre. */}
                    <p className="flex items-center gap-2 text-lecture font-extrabold tracking-tight">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: event.color }}
                      />
                      {event.name}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-3">
                      {dateFr(event.eventDate)}
                      <span className={`rounded-full px-2 py-0.5 font-bold ${badge.tone}`}>
                        {badge.text}
                      </span>
                    </p>
                    {event._count && (
                      <p className="mt-1 text-xs text-ink-3">
                        {event._count.rolls} invité{event._count.rolls > 1 ? 's' : ''}
                        {' · '}
                        {event._count.photos} vue{event._count.photos > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
