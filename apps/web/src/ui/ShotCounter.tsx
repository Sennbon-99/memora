// apps/web/src/ui/ShotCounter.tsx
// Compteur de vues restantes, dessine comme le compteur d'un appareil jetable.
//
// C'est l'element le plus regarde de l'application : il porte a lui seul la
// contrainte du produit. Les poses offertes sont montrees a part, pour que
// l'invite comprenne d'ou vient le supplement.
//
// Le chiffre roule au lieu de se remplacer. Sur un jetable, le compteur est
// un disque grave qui tourne d'un cran a chaque declenchement, et ce cran est
// la seule confirmation qu'on obtienne : il n'y a pas d'ecran pour verifier.
// Memora est dans le meme cas — aucun apercu apres la pose — donc le compteur
// doit se voir bouger. Un nombre qui se remplace passe inapercu quand on
// vient de baisser l'appareil.

interface ShotCounterProps {
  shotsLeft: number;
  bonusShots: number;
  /** Poses prises mais pas encore transmises, faute de reseau. */
  queued?: number;
}

/** Hauteur d'un cran, en pixels. Elle cale la fenetre et le deplacement. */
const CRAN = 30;

const CHIFFRES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Un rang du compteur.
 *
 * Les dix chiffres sont empiles et la colonne se deplace : c'est un disque
 * grave deroule a plat. Chaque rang roule a sa propre vitesse — les unites
 * les premieres, les dizaines juste apres — parce qu'un mecanisme reel
 * entraine ses disques l'un par l'autre, jamais tous ensemble.
 */
function Rang({ chiffre, retard }: { chiffre: number; retard: number }) {
  return (
    <span
      className="relative block overflow-hidden"
      style={{ height: CRAN, width: '0.62em' }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-x-0 top-0 transition-transform duration-500
          motion-reduce:transition-none"
        style={{
          transform: `translateY(${-chiffre * CRAN}px)`,
          // Une amorce franche puis une fin qui traine : le disque part au
          // coup de ressort et vient buter sur son cran.
          transitionTimingFunction: 'cubic-bezier(.2,.9,.2,1)',
          transitionDelay: `${retard}ms`,
        }}
      >
        {CHIFFRES.map((valeur) => (
          <span
            key={valeur}
            className="flex items-center justify-center"
            style={{ height: CRAN }}
          >
            {valeur}
          </span>
        ))}
      </span>
    </span>
  );
}

export function ShotCounter({ shotsLeft, bonusShots, queued = 0 }: ShotCounterProps) {
  const total = shotsLeft + bonusShots;
  // Deux rangs toujours affiches, comme sur un jetable : le compteur ne
  // retrecit pas en passant de 10 a 9, sinon toute la barre se decale.
  const rangs = String(Math.min(total, 99)).padStart(2, '0').split('').map(Number);

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 min-w-14 items-center justify-center rounded-champ bg-well
          px-3 font-mono text-2xl font-bold tabular-nums text-a-well
          ring-1 ring-edge"
      >
        {rangs.map((chiffre, rang) => (
          // Les dizaines demarrent avant les unites : rang 0 est le rang des
          // dizaines, il part sans retard, les unites le suivent.
          <Rang key={rang} chiffre={chiffre} retard={rang === 0 ? 0 : 60} />
        ))}
      </div>

      {/* Le nombre annonce aux lecteurs d'ecran. La colonne de chiffres porte
          les dix valeurs empilees : lue telle quelle, elle donnerait une suite
          absurde, d'ou aria-hidden sur les rangs et ce doublon ici. */}
      <p className="sr-only" aria-live="polite">
        {total} {total > 1 ? 'vues restantes' : 'vue restante'}
      </p>

      <div className="text-xs leading-tight text-ink-2">
        {/* Deja lu par le doublon ci-dessus, avec le nombre. Sans ce retrait,
            un lecteur d'ecran annonce « 24 vues restantes, vues restantes ». */}
        <div aria-hidden="true">{total > 1 ? 'vues restantes' : 'vue restante'}</div>
        {bonusShots > 0 && (
          <div className="text-a1">dont {bonusShots} offertes</div>
        )}
        {queued > 0 && (
          <div className="text-a1">{queued} en attente d'envoi</div>
        )}
      </div>
    </div>
  );
}
