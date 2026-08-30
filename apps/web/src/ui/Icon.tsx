// apps/web/src/ui/Icon.tsx
// Jeu d'icones de l'application.
//
// Dessine a la main plutot qu'importe d'une bibliotheque. Trois raisons :
// aucune des grandes collections ne connait la pellicule, la planche contact
// ou l'obturateur, qui sont le vocabulaire du produit ; un jeu importe pese
// plus que la trentaine de traces reellement utilises ; et le trait peut
// suivre la charte au lieu de la subir.
//
// Toutes sur une grille de 24, trait de 1,6 comme la barre d'onglets, bouts
// arrondis. Les pleines portent `plein` : leur trace se remplit proprement,
// ce que les traces ajoures ne supportent pas.

interface Trace {
  d: string;
  /** Le trace se laisse remplir sans devenir une tache. */
  plein?: boolean;
  /** Second trace, toujours en trait, superpose au premier. */
  detail?: string;
}

export const ICONES = {
  // Le produit
  pellicule: {
    d: 'M3 6h18v12H3z',
    plein: true,
    detail: 'M6 6v12M18 6v12M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3',
  },
  obturateur: {
    d: 'M12 3a9 9 0 100 18 9 9 0 000-18z',
    detail: 'M12 3l4.5 7.8M21 12h-9M16.5 19.8L12 12M7.5 19.8L12 12M3 12l7.8-4.5',
  },
  planche: {
    d: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
    plein: true,
  },
  qr: {
    d: 'M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4z',
    plein: true,
    detail: 'M15 15h2v2h-2zM19 15h1M15 19h2M19 19h1',
  },
  vues: { d: 'M12 21a9 9 0 100-18 9 9 0 000 18z', detail: 'M12 7v5l3.5 2' },

  // Personnes
  personne: { d: 'M12 4a4 4 0 110 8 4 4 0 010-8zM4 21a8 8 0 0116 0z', plein: true },
  groupe: {
    d: 'M9 4a4 4 0 110 8 4 4 0 010-8zM1 21a8 8 0 0116 0zM18 6a3 3 0 110 6 3 3 0 010-6zM18 14a6 6 0 016 6h-6z',
    plein: true,
  },
  // Volontairement non remplissable : l'objectif est un trace interieur, et
  // rempli il disparait dans le boitier — l'icone devient une tache. Meme
  // raison que le rouage ecarte de la barre d'onglets.
  photographe: {
    d: 'M3 7h4l1.5-2h7L17 7h4v13H3z',
    detail: 'M12 10.5a3 3 0 100 6 3 3 0 000-6z',
  },

  // Reperes
  calendrier: { d: 'M4 6h16v14H4z', detail: 'M8 3v5M16 3v5M4 11h16' },
  lieu: { d: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z', detail: 'M12 8a2.5 2.5 0 100 5 2.5 2.5 0 000-5z' },
  horloge: { d: 'M12 21a9 9 0 100-18 9 9 0 000 18z', detail: 'M12 7.5V12l3 1.8' },

  // Actions
  plus: { d: 'M12 5v14M5 12h14' },
  coche: { d: 'M4.5 12.5l5 5 10-11' },
  croix: { d: 'M6 6l12 12M18 6L6 18' },
  chevron: { d: 'M9 5l7 7-7 7' },
  retour: { d: 'M15 5l-7 7 7 7' },
  partager: { d: 'M12 15V3', detail: 'M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6' },
  telecharger: { d: 'M12 3v12', detail: 'M8 11l4 4 4-4M5 19h14' },
  lien: { d: 'M10 13.5a4 4 0 015.7 0l2.6-2.6a4 4 0 00-5.7-5.7l-1.6 1.6M14 10.5a4 4 0 00-5.7 0l-2.6 2.6a4 4 0 005.7 5.7l1.6-1.6' },
  imprimer: { d: 'M7 9V3h10v6', detail: 'M4 9h16v7h-3v5H7v-5H4zM8 16h8' },
  corbeille: { d: 'M4 6h16', detail: 'M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7' },
  crayon: { d: 'M4 20l1-4L16 5l3 3L8 19z', detail: 'M14 7l3 3' },
  recherche: { d: 'M11 4a7 7 0 100 14 7 7 0 000-14z', detail: 'M16 16l4 4' },

  // Etats
  alerte: { d: 'M12 3l9.5 17H2.5z', detail: 'M12 9v5M12 17.2v.1' },
  info: { d: 'M12 21a9 9 0 100-18 9 9 0 000 18z', detail: 'M12 11v5M12 7.6v.1' },
  verrou: { d: 'M5 11h14v10H5z', detail: 'M8 11V7.5a4 4 0 018 0V11' },
  eclair: { d: 'M13 3L5 14h6l-1 7 8-11h-6z', plein: true },
  oeil: { d: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z', detail: 'M12 9a3 3 0 100 6 3 3 0 000-6z' },
  carte: { d: 'M3 6h18v13H3z', detail: 'M3 10.5h18M6.5 15h4' },
  etoile: { d: 'M12 3l2.7 6.2 6.8.6-5.1 4.5 1.5 6.6L12 17.5 6.1 20.9l1.5-6.6L2.5 9.8l6.8-.6z', plein: true },
} as const satisfies Record<string, Trace>;

export type NomIcone = keyof typeof ICONES;

interface IconProps {
  nom: NomIcone;
  /** Cote en pixels. 20 par defaut : la taille d'une icone posee dans du texte. */
  taille?: number;
  /** Remplit le trace principal, quand il s'y prete. */
  plein?: boolean;
  className?: string;
}

export function Icon({ nom, taille = 20, plein = false, className = '' }: IconProps) {
  const trace = ICONES[nom] as Trace;
  const remplir = plein && trace.plein === true;

  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      // Decorative par defaut : une icone de cette application accompagne
      // toujours un mot. La doubler dans un lecteur d'ecran ferait entendre
      // deux fois la meme chose.
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={trace.d} fill={remplir ? 'currentColor' : 'none'} />
      {trace.detail && <path d={trace.detail} />}
    </svg>
  );
}
