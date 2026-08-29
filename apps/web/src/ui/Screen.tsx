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
      {/* Le pied est collant : sur un ecran qui defile — une planche de
          quatre-vingts photographies, une liste de pellicules — l'action
          principale se retrouverait sinon des milliers de pixels plus bas,
          et personne ne la verrait. */}
      {footer && (
        <div
          className="sticky z-20 border-t border-white/10 bg-[#1C1916]/95
            px-6 pb-6 pt-3 backdrop-blur"
          style={{ bottom: 'var(--tabbar, 0px)' }}
        >
          <div className="mx-auto w-full max-w-md">{footer}</div>
        </div>
      )}
    </div>
  );
}
