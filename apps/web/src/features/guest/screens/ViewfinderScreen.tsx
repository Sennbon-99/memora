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
        <div className="rounded-champ bg-black/50 px-4 py-2 backdrop-blur">
          <ShotCounter shotsLeft={shotsLeft} bonusShots={bonusShots} queued={queued} />
        </div>
        <span className="mt-2 max-w-32 truncate rounded-full bg-black/50 px-3 py-1
          text-xs text-ink-2 backdrop-blur">
          {eventName}
        </span>
      </header>

      {!online && (
        <p
          role="status"
          className="relative z-20 mx-5 mt-3 rounded-carte bg-a-doux ring-1 ring-edge px-4 py-2.5
            text-center text-sm text-a1 backdrop-blur"
        >
          Hors ligne. Continuez, vos vues partiront au retour du réseau.
        </p>
      )}

      {moment && (
        <p
          role="status"
          className="relative z-20 mx-5 mt-3 rounded-carte bg-a1 px-4 py-2.5
            text-center text-sm font-semibold text-on-a1"
        >
          {moment.label} — c'est maintenant
        </p>
      )}

      <div className="flex-1" />

      <footer className="relative z-20 flex flex-col items-center gap-4 pb-10 safe-bottom">
        {shot.isError && (
          <p role="alert" className="mx-6 rounded-carte bg-danger-doux px-4 py-2 text-sm text-danger">
            {shot.error.message}
          </p>
        )}

        <button
          onClick={takeShot}
          disabled={shot.isPending || total === 0}
          aria-label={`Prendre une photo, ${total} restantes`}
          className="h-20 w-20 rounded-full bg-white ring-4 ring-edge
            transition active:scale-95 disabled:opacity-40
            focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="sr-only">Declencher</span>
        </button>
      </footer>
    </div>
  );
}
