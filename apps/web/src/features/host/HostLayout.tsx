// apps/web/src/features/host/HostLayout.tsx
// Barre haute et garde d'authentification.
//
// La barre n'apparait qu'une fois une soiree choisie : sur la liste des
// evenements et pendant la creation, il n'y a rien a naviguer, et un menu
// sur un ecran vide n'est que de la decoration.

import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '../../ui/Spinner.js';
import { useEvent, useEvents } from './useEvents.js';
import { useLogout, useSession } from './useAuth.js';
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

/** Barre haute avec selecteur d'evenement. */
export function HostLayout() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: list } = useEvents();
  const { data: current } = useEvent(eventId);
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  const initials = (session?.name ?? '')
    .split(' ').map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();

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

        <button
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/hote/connexion') })}
          title="Se déconnecter"
          className={`grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)]
            text-[11px] font-extrabold text-[var(--accent-text)] ${current ? '' : 'ml-auto'}`}
        >
          {initials || '·'}
        </button>
      </header>

      <div className="flex-1"><Outlet /></div>
    </div>
  );
}
