// apps/web/src/ui/Screen.tsx
// Enveloppe commune a tous les ecrans.
//
// Elle tient quatre choses au meme endroit : les zones sures de l'ecran, la
// largeur maximale, le titre annonce aux lecteurs d'ecran, et les deux bandes
// de pellicule qui bordent l'application.

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Suit la sortie du titre hors de l'ecran.
 *
 * Rend l'ancre a poser sous le titre, et si celui-ci a quitte le champ. Le
 * repli n'est arme que sur les ecrans qui le demandent : sur un ecran court,
 * un bandeau qui apparait sans que rien n'ait defile serait un clignotement.
 */
function useTitreReplie(actif: boolean) {
  const ancre = useRef<HTMLSpanElement | null>(null);
  const [replie, setReplie] = useState(false);

  useEffect(() => {
    if (!actif) {
      setReplie(false);
      return;
    }
    const cible = ancre.current;
    if (!cible) return;

    const observateur = new IntersectionObserver(
      ([entree]) => setReplie(entree !== undefined && !entree.isIntersecting),
      // La marge remonte la frontiere sous le bandeau : sans elle, le titre
      // reste techniquement visible derriere lui et le repli n'arrive jamais.
      { rootMargin: '-56px 0px 0px 0px', threshold: 0 },
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [actif]);

  return { ancre, replie };
}

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
  /**
   * Le titre se replie en bandeau quand il sort de l'ecran.
   *
   * Deux conditions, verifiees a l'usage :
   *   - l'ecran doit defiler vraiment. Sur un ecran court le bandeau
   *     n'apparaitrait jamais ; sur un ecran a peine plus haut que la
   *     fenetre, il clignoterait.
   *   - l'ecran ne doit pas deja porter d'en-tete colle. L'espace hote en a
   *     un, en top-0 z-30 comme ce bandeau : les deux se recouvraient et la
   *     marque disparaissait derriere le titre. Le repli sert donc les
   *     ecrans de l'invite, qui n'ont pas d'en-tete.
   */
  titreRepliable?: boolean;
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
  title, hideTitle, subtitle, children, footer, code, titreRepliable,
}: ScreenProps) {
  const replie = useTitreReplie(titreRepliable === true && hideTitle !== true);

  return (
    // flex-1 et non min-h-full seul : le parent est lui-meme en hauteur
    // minimale, donc un pourcentage ne se resout contre rien et le quadrillage
    // s'arretait a la derniere ligne de texte. S'etirer dans la colonne du
    // parent ne depend, lui, d'aucune hauteur definie.
    <div className="quadrille flex min-h-full flex-1 flex-col safe-top safe-bottom">
      <Bande cote="gauche" haut={code?.hautGauche ?? 'MEMORA 400'} bas={code?.basGauche} />
      <Bande cote="droite" haut={code?.hautDroite} bas={code?.basDroite} />

      {/* Le bandeau replie. Il ne remplace pas le titre : il en est la trace,
          et il n'existe que le temps ou le vrai titre est hors de l'ecran. */}
      {titreRepliable && !hideTitle && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-x-0 top-0 z-30 border-b
            border-edge bg-pap/92 px-5 py-3 backdrop-blur
            transition-opacity duration-200 motion-reduce:transition-none
            ${replie.replie ? 'opacity-100' : 'opacity-0'}`}
        >
          <p className="decoupe mx-auto max-w-md truncate text-bandeau leading-none safe-top">
            {title}
          </p>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10">
        <h1
          className={
            hideTitle
              ? 'sr-only'
              : 'decoupe text-affiche leading-[0.95] tracking-tight text-balance'
          }
        >
          {title}
        </h1>
        {subtitle && !hideTitle && (
          <p className="mt-3 text-lecture leading-relaxed text-ink-2">{subtitle}</p>
        )}
        {/* Sentinelle : sa sortie de l'ecran declenche le repli. Un ecouteur
            de defilement ferait le meme travail, mais a chaque image et sur
            le fil principal ; l'observateur ne parle que deux fois. */}
        <span ref={replie.ancre} aria-hidden="true" className="block h-px" />
        <div className="flex flex-1 flex-col">{children}</div>
      </main>

      {/* Le pied est collant : sur un ecran qui defile — une planche de
          quatre-vingts vues, une liste de pellicules — l'action principale se
          retrouverait sinon des milliers de pixels plus bas, et personne ne
          la verrait. */}
      {footer && (
        <div
          className="sticky z-20 border-t border-edge bg-pap
            px-5 pb-6 pt-3"
          style={{ bottom: 'var(--tabbar, 0px)' }}
        >
          <div className="mx-auto w-full max-w-md">{footer}</div>
        </div>
      )}
    </div>
  );
}
