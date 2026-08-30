// apps/web/src/ui/Button.tsx
// Bouton unique de l'application, decline en trois tons.
//
// La variante primaire prend la couleur de l'evenement, et sa couleur de
// texte est calculee, jamais ecrite en dur : sur un evenement jaune vif, du
// blanc serait illisible.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Tone = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  full?: boolean;
  children: ReactNode;
}

const TONES: Record<Tone, string> = {
  primary: 'bg-[var(--accent)] text-[var(--accent-text)] active:brightness-90',
  ghost: 'bg-surface text-paper border border-gold/20 active:bg-surface/70',
  danger: 'bg-transparent text-red-400 active:bg-red-400/10',
};

export function Button({ tone = 'primary', full, className = '', ...props }: ButtonProps) {
  return (
    <button
      // 48 pixels de haut : la cible tactile minimale recommandee par le RGAA.
      className={`min-h-12 rounded-xl px-6 text-base font-semibold transition
        disabled:opacity-40 disabled:pointer-events-none
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]
        ${TONES[tone]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    />
  );
}
