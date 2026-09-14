// apps/web/src/features/host/screens/EventListScreen.tsx
// Liste des soirees. Premier ecran apres la connexion.

import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../ui/Icon.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { EmptyState } from '../../../ui/EmptyState.js';
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
      title="Mes soirées"
      subtitle="Les petits moments. Tous ensemble."
      footer={
        <Button full onClick={() => navigate('/hote/nouvelle')}>
          <Icon nom="plus" /> Créer une soirée
        </Button>
      }
    >
      {events.length === 0 ? (
        <EmptyState>
          Rien pour l’instant.<br />Créez votre première soirée, imprimez le kit,
          et vos invités photographient.
        </EmptyState>
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
                  <div className="studio-cover flex min-h-48 flex-col justify-between gap-6">
                    <span className="self-start rounded-full bg-white px-3 py-1.5 text-petit font-semibold text-[#49374d]">
                      {badge.text}
                    </span>
                    <div>
                      <p className="text-titre font-semibold leading-tight tracking-tight">{event.name}</p>
                      <p className="mt-2 text-note">{dateFr(event.eventDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <p className="text-note text-ink-2">
                      {event._count ? `${event._count.rolls} invités · ${event._count.photos} photos` : 'Préparer votre soirée'}
                    </p>
                    <Icon nom="chevron" className="text-a1" />
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
