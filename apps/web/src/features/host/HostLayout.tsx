// apps/web/src/features/host/HostLayout.tsx
// Barre haute et garde d'authentification.
//
// La barre n'apparait qu'une fois une soiree choisie : sur la liste des
// evenements et pendant la creation, il n'y a rien a naviguer, et un menu
// sur un ecran vide n'est que de la decoration.

import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '../../ui/Spinner.js';
import { useEvent, useEvents } from './useEvents.js';
import { useSession } from './useAuth.js';
import { TabBar } from '../../ui/TabBar.js';
import { useState } from 'react';

/** Protege toutes les routes de l'espace hote. */
export function RequireHost() {
  const { data: user, isPending } = useSession();
  const location = useLocation();

  if (isPending) return <Spinner label="Ouverture de votre session" />;
  // On memorise la destination : apres connexion, on y retourne plutot que
  // de deposer l'hote sur un tableau de bord qu'il n'a pas demande.
  if (!user) return <Navigate to="/hote/connexion" replace state={{ from: location.pathname }} />;

  return <Outlet />;
}

/**
 * Coquille de l'espace hote : barre haute et barre d'onglets.
 *
 * Un seul motif de navigation, pas deux. Tout ce qui etait derriere l'avatar
 * en haut a droite est passe dans l'onglet Reglages : sur un ecran de 6,9
 * pouces, le coin superieur droit est le point le plus difficile a atteindre
 * d'une seule main, et c'est exactement la ou se tient l'hote pendant la fete.
 *
 * La barre d'onglets appartient a une soiree. La liste des evenements et le
 * formulaire de creation ne l'affichent pas : il n'y a rien a naviguer.
 */
export function HostLayout() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data: list } = useEvents();
  const { data: current } = useEvent(eventId);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10
        bg-film/95 px-4 pb-3 pt-3 backdrop-blur safe-top">
        <button
          onClick={() => navigate('/hote')}
          className="text-[15px] font-extrabold tracking-tight"
        >
          memora<span className="text-[var(--accent)]">.</span>
        </button>

        {current && (
          <div className="relative ml-auto">
            <button
              onClick={() => setOpen((was) => !was)}
              aria-expanded={open}
              className="max-w-40 truncate rounded-full border border-white/10 px-3 py-1.5
                text-xs text-white/60"
            >
              {current.event.name} ▾
            </button>

            {open && (
              <ul className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-2xl
                border border-white/10 bg-[#252119] py-1 shadow-2xl">
                {(list?.events ?? []).map((event) => (
                  <li key={event.id}>
                    <button
                      onClick={() => { setOpen(false); navigate(`/hote/${event.id}`); }}
                      className={`w-full truncate px-4 py-2.5 text-left text-[13px]
                        ${event.id === eventId ? 'text-[var(--accent)] font-semibold' : 'text-white/70'}`}
                    >
                      {event.name}
                    </button>
                  </li>
                ))}
                <li className="mt-1 border-t border-white/10 pt-1">
                  <button
                    onClick={() => { setOpen(false); navigate('/hote'); }}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-white/50"
                  >
                    Toutes mes soirées
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}

      </header>

      <div className="flex-1"><Outlet /></div>

      {/* La barre n'apparait qu'une fois une soiree choisie. */}
      {current && <TabBar eventId={eventId} />}
    </div>
  );
}
