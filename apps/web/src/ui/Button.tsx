// apps/web/src/ui/Button.tsx
// Bouton unique de l'application, decline en trois tons.
//
// La variante primaire prend l'accent du carnet, et sa couleur de texte est
// ecrite par le carnet plutot que devinee a l'execution : --color-on-a1 est
// pose une fois, verifie au contraste par les tests, et ne peut plus derailler.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Tone = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  full?: boolean;
  children: ReactNode;
}

const TONES: Record<Tone, string> = {
  primary: 'bg-a1 text-on-a1 active:brightness-90',
  ghost: 'bg-pap-2 text-ink border border-edge active:bg-appui',
  // Le voile d'appui garde ici un modificateur d'opacite : les signaux ne sont
  // redefinis par aucun carnet, leur valeur figee a la compilation est donc
  // toujours la bonne.
  danger: 'bg-transparent text-danger active:bg-danger/10',
};

export function Button({ tone = 'primary', full, className = '', ...props }: ButtonProps) {
  return (
    <button
      // 48 pixels de haut : la cible tactile minimale recommandee par le RGAA.
      className={`min-h-12 rounded-champ px-6 text-base font-semibold transition
        disabled:opacity-40 disabled:pointer-events-none
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-a1
        ${TONES[tone]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    />
  );
}
