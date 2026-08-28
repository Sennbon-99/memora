// apps/web/src/ui/Screen.tsx
// Enveloppe commune a tous les ecrans du parcours invite.
//
// Elle tient trois choses au meme endroit : les zones sures de l'ecran,
// la largeur maximale, et le titre annonce aux lecteurs d'ecran.

import type { ReactNode } from 'react';

interface ScreenProps {
  title: string;
  /** Masque le titre visuellement, mais le laisse aux lecteurs d'ecran. */
  hideTitle?: boolean;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Screen({ title, hideTitle, subtitle, children, footer }: ScreenProps) {
  return (
    <div className="flex min-h-full flex-col safe-top safe-bottom">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-10">
        <h1 className={hideTitle ? 'sr-only' : 'text-3xl font-bold tracking-tight text-balance'}>
          {title}
        </h1>
        {subtitle && !hideTitle && (
          <p className="mt-3 text-[15px] leading-relaxed text-white/60">{subtitle}</p>
        )}
        <div className="flex flex-1 flex-col">{children}</div>
      </main>
      {footer && <div className="mx-auto w-full max-w-md px-6 pb-8 pt-4">{footer}</div>}
    </div>
  );
}
