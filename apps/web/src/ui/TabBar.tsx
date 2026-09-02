// apps/web/src/ui/TabBar.tsx
// Barre d'onglets de l'espace hote.
//
// Elle est en bas et non en haut : l'hote pilote sa soiree debout, au milieu
// de la fete, a une main. Le haut d'un ecran de 6,9 pouces demande de changer
// de prise ; le bas est sous le pouce.
//
// Elle appartient a une soiree, pas au compte : la liste des evenements ne
// l'affiche pas.

import { NavLink, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

interface Tab {
  to: string;
  label: string;
  /** Icone : son trace, et si le remplir a l'etat actif reste lisible. */
  icon: { d: string; fillable: boolean };
  /** Vrai pour l'onglet racine, dont l'adresse est le prefixe des autres. */
  end: boolean;
}

/**
 * Trois icones pleines et une en trait.
 *
 * Le rouage a ete abandonne : ses dents forment un trace trop dense pour
 * etre rempli, il apparaissait comme une tache a l'ecran. Des curseurs
 * disent la meme chose et se dessinent proprement a dix-neuf pixels.
 */
const ICONS = {
  soiree: { d: 'M12 2l2.6 6.3L21 9l-4.8 4.3L17.6 20 12 16.6 6.4 20l1.4-6.7L3 9l6.4-.7z', fillable: true },
  photos: { d: 'M3 5h5l1.5-2h5L16 5h5v15H3z', fillable: true },
  gens: { d: 'M9 4a4 4 0 110 8 4 4 0 010-8zM1 21a8 8 0 0116 0zM18 6a3 3 0 110 6 3 3 0 010-6zM18 14a6 6 0 016 6h-6z', fillable: true },
  reglages: { d: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M8 14v6', fillable: false },
} as const;

export function TabBar({ eventId }: { eventId: string }) {
  const { pathname } = useLocation();

  const tabs: Tab[] = useMemo(() => [
    { to: `/hote/${eventId}`, label: 'Soirée', icon: ICONS.soiree, end: true },
    { to: `/hote/${eventId}/photos`, label: 'Photos', icon: ICONS.photos, end: false },
    { to: `/hote/${eventId}/invites`, label: 'Invités', icon: ICONS.gens, end: false },
    { to: `/hote/${eventId}/reglages`, label: 'Réglages', icon: ICONS.reglages, end: false },
  ], [eventId]);

  // L'indicateur glisse d'un onglet a l'autre : il ne dit pas seulement ou
  // l'on est, il dit d'ou l'on vient. C'est la seule animation de navigation
  // qui apporte une information que le texte ne donne pas deja.
  //
  // Il disparait quand aucun onglet ne correspond — un ecran pousse comme
  // les moments forts ou le kit QR. Le rabattre sur le premier onglet
  // ferait affirmer a la barre une position fausse.
  const active = tabs.findLastIndex((tab) =>
    tab.end ? pathname === tab.to : pathname.startsWith(tab.to));

  return (
    <nav
      aria-label="Sections de la soirée"
      className="sticky bottom-0 z-40 flex border-t border-edge bg-well
        pt-2 safe-bottom"
      // La hauteur est publiee sur l'element racine : le pied collant des
      // ecrans s'en sert pour se poser juste au-dessus, au lieu de glisser
      // dessous. Mesurer plutot que coder la valeur en dur laisse la zone
      // sure du systeme varier d'un appareil a l'autre.
      ref={(node) => {
        if (!node) return;
        const publier = () => document.documentElement.style
          .setProperty('--tabbar', `${node.offsetHeight}px`);
        publier();
        const observer = new ResizeObserver(publier);
        observer.observe(node);
        return () => {
          observer.disconnect();
          document.documentElement.style.removeProperty('--tabbar');
        };
      }}
    >
      {active >= 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-0.5 rounded-full bg-a-well
            transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: 'calc(25% - 22px)',
            marginLeft: 11,
            transform: `translateX(${active * 100}%)`,
          }}
        />
      )}

      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 pb-1 pt-1 text-micro
             ${isActive ? 'text-a-well' : 'text-ink-well-2'}`
          }
        >
          {({ isActive }) => (
            <>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d={tab.icon.d}
                  fill={isActive && tab.icon.fillable ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={isActive && !tab.icon.fillable ? 2.4 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {tab.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
