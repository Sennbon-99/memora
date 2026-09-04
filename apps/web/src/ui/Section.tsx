// apps/web/src/ui/Section.tsx
// Une section de l'espace organisateur, posee comme un tirage.
//
// Le titre etait jusqu'ici pose nu sur le quadrillage, et seul le contenu
// portait une carte. Le titre appartient pourtant a ce qu'il annonce : il
// rentre donc dans la carte avec lui, et le carnet ne se voit plus qu'entre
// les sections. C'est ce qui donne a l'ecran sa lecture en pile de fiches.

import type { ReactNode } from 'react';

interface SectionProps {
  /** Le titre, en petites capitales. Il n'est jamais long. */
  title: string;
  /** Ce que la section annonce, avant son contenu. Facultatif. */
  intro?: ReactNode;
  children?: ReactNode;
  /**
   * Contenu a bord perdu, pour une liste de lignes separees par des filets :
   * la carte ne pose alors aucune marge interieure autour des enfants, ce
   * sont eux qui touchent les bords.
   */
  flush?: boolean;
  className?: string;
}

export function Section({ title, intro, children, flush, className = '' }: SectionProps) {
  return (
    <section
      className={`mt-6 overflow-hidden rounded-carte border border-edge bg-pap-2
        shadow-[var(--ombre-tirage)] ${className}`}
    >
      <div className={flush ? 'px-5 pt-5' : 'p-5'}>
        <h2 className="font-mono text-etiquette uppercase tracking-[0.16em] text-ink-3">
          {title}
        </h2>
        {intro && <p className="mt-2 text-note leading-relaxed text-ink-2">{intro}</p>}
        {children && !flush && <div className="mt-4">{children}</div>}
      </div>

      {/* A bord perdu, les enfants sortent de la marge interieure : un filet
          de separation doit courir d'un bord a l'autre de la carte. */}
      {children && flush && <div className="mt-4">{children}</div>}
    </section>
  );
}
