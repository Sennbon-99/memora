// apps/web/src/ui/Screen.tsx
// Enveloppe commune a tous les ecrans.
//
// Elle tient quatre choses au meme endroit : les zones sures de l'ecran, la
// largeur maximale, le titre annonce aux lecteurs d'ecran, et les deux bandes
// de pellicule qui bordent l'application.

import type { ReactNode } from 'react';

/** Ce que portent les bandes, de haut en bas, sur chaque cote. */
export interface CodePellicule {
  hautGauche?: string;
  basGauche?: string;
  hautDroite?: string;
  basDroite?: string;
}

interface ScreenProps {
  title: string;
  /** Masque le titre visuellement, mais le laisse aux lecteurs d'ecran. */
  hideTitle?: boolean;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Inscriptions des bandes laterales. Elles disent ou l'on se trouve —
   * quelle pellicule, quelle table, quelle date — la ou une application
   * ordinaire mettrait un fil d'Ariane.
   */
  code?: CodePellicule;
  /** Le viseur occupe toute la surface : il n'a ni bandes ni marges. */
  pleinCadre?: boolean;
}

/**
 * Une bande perforee.
 *
 * Elle est decorative pour un lecteur d'ecran — la meme information est
 * toujours disponible ailleurs dans la page — d'ou aria-hidden.
 */
// Les proprietes acceptent explicitement undefined : exactOptionalPropertyTypes
// distingue « absente » de « presente et vide », et l'appelant transmet ici le
// resultat d'un acces facultatif.
function Bande({
  cote, haut, bas,
}: { cote: 'gauche' | 'droite'; haut?: string | undefined; bas?: string | undefined }) {
  return (
    <div className={`bande bande-${cote}`} aria-hidden="true">
      <span>{haut ?? ''}</span>
      <span>{bas ?? ''}</span>
    </div>
  );
}

export function Screen({
  title, hideTitle, subtitle, children, footer, code, pleinCadre,
}: ScreenProps) {
  // Le viseur se passe de tout : ni bandes, ni marges, ni titre visible.
  if (pleinCadre) {
    return (
      <div className="flex min-h-full flex-col">
        <h1 className="sr-only">{title}</h1>
        {children}
      </div>
    );
  }

  return (
    <div className="halo flex min-h-full flex-col safe-top safe-bottom">
      <Bande cote="gauche" haut={code?.hautGauche ?? 'MEMORA 400'} bas={code?.basGauche} />
      <Bande cote="droite" haut={code?.hautDroite} bas={code?.basDroite} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10">
        <h1
          className={
            hideTitle
              ? 'sr-only'
              : 'font-serif text-[42px] leading-[0.95] tracking-tight text-balance'
          }
        >
          {title}
        </h1>
        {subtitle && !hideTitle && (
          <p className="mt-3 text-[15px] leading-relaxed text-paper/55">{subtitle}</p>
        )}
        <div className="flex flex-1 flex-col">{children}</div>
      </main>

      {/* Le pied est collant : sur un ecran qui defile — une planche de
          quatre-vingts vues, une liste de pellicules — l'action principale se
          retrouverait sinon des milliers de pixels plus bas, et personne ne
          la verrait. */}
      {footer && (
        <div
          className="sticky z-20 border-t border-gold/20 bg-film/95
            px-5 pb-6 pt-3 backdrop-blur"
          style={{ bottom: 'var(--tabbar, 0px)' }}
        >
          <div className="mx-auto w-full max-w-md">{footer}</div>
        </div>
      )}
    </div>
  );
}
