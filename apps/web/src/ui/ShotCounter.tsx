// apps/web/src/ui/ShotCounter.tsx
// Compteur de vues restantes, dessine comme le compteur d'un appareil jetable.
//
// C'est l'element le plus regarde de l'application : il porte a lui seul la
// contrainte du produit. Les poses offertes sont montrees a part, pour que
// l'invite comprenne d'ou vient le supplement.

interface ShotCounterProps {
  shotsLeft: number;
  bonusShots: number;
  /** Poses prises mais pas encore transmises, faute de reseau. */
  queued?: number;
}

export function ShotCounter({ shotsLeft, bonusShots, queued = 0 }: ShotCounterProps) {
  const total = shotsLeft + bonusShots;

  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div
        className="flex h-11 min-w-14 items-center justify-center rounded-md bg-[#0E0A13]
          px-3 font-mono text-2xl font-bold tabular-nums text-gold
          ring-1 ring-gold/30"
      >
        {total}
      </div>
      <div className="text-xs leading-tight text-paper/50">
        <div>{total > 1 ? 'vues restantes' : 'vue restante'}</div>
        {bonusShots > 0 && (
          <div className="text-gold">dont {bonusShots} offertes</div>
        )}
        {queued > 0 && (
          <div className="text-gold">{queued} en attente d'envoi</div>
        )}
      </div>
    </div>
  );
}
