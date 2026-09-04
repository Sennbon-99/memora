// apps/web/src/ui/EmptyState.tsx
// Le vide, pose comme un tirage.
//
// Une phrase seule au milieu du quadrillage ne se lit pas : elle n'a aucune
// surface sous elle, et le carnet passe dessous. Les ecrans vides prennent
// donc la meme carte que le reste du produit — c'est le fond qui porte le
// contraste, jamais la taille du texte.
//
// La phrase, elle, reste ecrite par l'ecran appelant. « Aucune demande, c'est
// plutot bon signe » ne se remplace pas par un texte generique : ce qu'il faut
// partager est la forme, pas les mots.

import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto mt-10 max-w-md rounded-carte border border-edge bg-pap-2 p-6
        text-center text-sm leading-relaxed text-ink-3 shadow-[var(--ombre-tirage)]"
    >
      {children}
    </div>
  );
}
