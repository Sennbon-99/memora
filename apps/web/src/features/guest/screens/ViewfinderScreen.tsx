// apps/web/src/features/guest/screens/ViewfinderScreen.tsx
// Le viseur. C'est l'ecran ou l'invite passe sa soiree.
//
// Trois partis pris, tous issus du produit :
//   - aucun apercu apres la pose, sauf si l'hote a active un mode d'apercu ;
//     on ne peut ni supprimer ni recommencer, comme avec un jetable
//   - le declencheur reste actif hors ligne, la pose part en file d'attente
//   - un flash blanc bref confirme la prise, faute d'apercu

import { useEffect, useState } from 'react';
import { Button } from '../../../ui/Button.js';
import { ShotCounter } from '../../../ui/ShotCounter.js';
import { QrCode } from '../../../ui/QrCode.js';
import { useCamera } from '../useCamera.js';
import { useShot } from '../useShot.js';
import { CameraDeniedScreen } from './CameraDeniedScreen.js';

interface ViewfinderScreenProps {
  slug: string;
  eventName: string;
  shotsLeft: number;
  bonusShots: number;
  queued: number;
  online: boolean;
  /** Moment fort declare par l'hote, pousse par le serveur. */
  moment: { label: string; endsAt: string } | null;
  onEmpty: () => void;
}

export function ViewfinderScreen({
  slug, eventName, shotsLeft, bonusShots, queued, online, moment, onEmpty,
}: ViewfinderScreenProps) {
  const { videoRef, state, start, capture } = useCamera();
  const shot = useShot(slug);
  const [flashing, setFlashing] = useState(false);
  // « Le carton a disparu sous les verres » est le cas le plus frequent :
  // un invite deja entre depanne son voisin en lui montrant son ecran.
  const [partage, setPartage] = useState(false);

  useEffect(() => { void start(); }, [start]);

  const total = shotsLeft + bonusShots;
  useEffect(() => { if (total === 0) onEmpty(); }, [total, onEmpty]);

  const takeShot = async () => {
    if (shot.isPending || total === 0 || state !== 'ready') return;

    // Le flash part avant l'attente reseau : le retour doit etre immediat,
    // sinon l'invite appuie deux fois.
    setFlashing(true);
    setTimeout(() => setFlashing(false), 120);

    try {
      shot.mutate(await capture());
    } catch {
      // Camera devenue indisponible entre-temps : l'ecran de secours prend
      // le relais au prochain rendu.
    }
  };

  if (state === 'denied' || state === 'unavailable') {
    return (
      <CameraDeniedScreen
        slug={slug}
        denied={state === 'denied'}
        shotsLeft={shotsLeft}
        bonusShots={bonusShots}
        queued={queued}
      />
    );
  }

  // pleine-largeur : le viseur deborde des bandes de pellicule. Le cadrage
  // prime ici sur la signature graphique — cinquante-deux pixels de moins,
  // c'est un visage coupe au bord de l'image.
  return (
    <div className="pleine-largeur relative flex h-full flex-col bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        // object-cover : le flux garde ses proportions, l'ecran est rempli.
        className="absolute inset-0 h-full w-full object-cover"
        aria-label="Viseur"
      />

      {flashing && (
        <div className="pointer-events-none absolute inset-0 z-30 bg-white" aria-hidden="true" />
      )}

      <header className="relative z-20 flex items-start justify-between gap-4 px-5 pt-4 safe-top">
        <div className="rounded-lg bg-black/50 px-4 py-2 backdrop-blur">
          <ShotCounter shotsLeft={shotsLeft} bonusShots={bonusShots} queued={queued} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="max-w-32 truncate rounded-full bg-black/50 px-3 py-1
            text-xs text-paper/70 backdrop-blur">
            {eventName}
          </span>
          <button
            type="button"
            onClick={() => setPartage(true)}
            aria-label="Montrer le code à quelqu’un"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/50
              text-paper/80 backdrop-blur active:bg-black/70"
          >
            {/* Un carre de visee, pas un faux QR code : l'icone dit le geste
                sans pretendre etre le code. Le vrai est derriere. */}
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
              <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
            </svg>
          </button>
        </div>
      </header>

      {partage && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6
            bg-film/95 px-8 backdrop-blur"
          style={{ animation: 'fade 180ms ease-out' }}
        >
          <p className="text-center text-[15px] leading-relaxed text-paper/70">
            Faites scanner cet écran. Votre voisin rejoint la même soirée,
            avec ses propres vingt-quatre poses.
          </p>
          {/* Le code est presente comme un tirage : bord blanc epais, comme
              sur le carton imprime. Le cadre porte l'identite, jamais le
              code. */}
          <div className="bg-white p-3 shadow-2xl">
            <QrCode
              value={`${window.location.origin}/e/${slug}`}
              size={216}
              label={`Code de la soirée ${eventName}`}
            />
          </div>
          <button
            type="button"
            onClick={() => setPartage(false)}
            className="min-h-12 rounded-xl border border-gold/25 px-8 text-base font-semibold
              text-paper active:bg-paper/8"
          >
            Fermer
          </button>
        </div>
      )}

      {!online && (
        <p
          role="status"
          className="relative z-20 mx-5 mt-3 rounded-xl bg-gold/18 ring-1 ring-gold/35 px-4 py-2.5
            text-center text-sm text-gold backdrop-blur"
        >
          Hors ligne. Continuez, vos vues partiront au retour du réseau.
        </p>
      )}

      {moment && (
        <p
          role="status"
          className="relative z-20 mx-5 mt-3 rounded-xl bg-[var(--accent)] px-4 py-2.5
            text-center text-sm font-semibold text-[var(--accent-text)]"
        >
          {moment.label} — c'est maintenant
        </p>
      )}

      <div className="flex-1" />

      <footer className="relative z-20 flex flex-col items-center gap-4 pb-10 safe-bottom">
        {shot.isError && (
          <p role="alert" className="mx-6 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-100">
            {shot.error.message}
          </p>
        )}

        <button
          onClick={takeShot}
          disabled={shot.isPending || total === 0}
          aria-label={`Prendre une photo, ${total} restantes`}
          className="h-20 w-20 rounded-full bg-white ring-4 ring-paper/30
            transition active:scale-95 disabled:opacity-40
            focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="sr-only">Declencher</span>
        </button>
      </footer>
    </div>
  );
}
