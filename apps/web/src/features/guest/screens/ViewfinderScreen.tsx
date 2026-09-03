// apps/web/src/features/guest/screens/ViewfinderScreen.tsx
// Le viseur. C'est l'ecran ou l'invite passe sa soiree.
//
// Trois partis pris, tous issus du produit :
//   - aucun apercu apres la pose, sauf si l'hote a active un mode d'apercu ;
//     on ne peut ni supprimer ni recommencer, comme avec un jetable
//   - le declencheur reste actif hors ligne, la pose part en file d'attente
//   - un obturateur bref confirme la prise, faute d'apercu

import { useEffect, useRef, useState } from 'react';
import { ShotCounter } from '../../../ui/ShotCounter.js';
import { QrCode } from '../../../ui/QrCode.js';
import { useCamera } from '../useCamera.js';
import { useShot } from '../useShot.js';
import { CameraDeniedScreen } from './CameraDeniedScreen.js';
import { prepare, previewUrl, type PreparedImage } from '../../../lib/image.js';
import { publicAppOrigin } from '../../../lib/api.js';
import type { PreviewMode } from '@memora/types';

interface ViewfinderScreenProps {
  slug: string;
  eventName: string;
  quotaShots: number;
  joinCode: string;
  previewMode: PreviewMode;
  shotsLeft: number;
  bonusShots: number;
  queued: number;
  online: boolean;
  /** Moment fort declare par l'hote, pousse par le serveur. */
  moment: { label: string; endsAt: string } | null;
  onEmpty: () => void;
}

export function ViewfinderScreen({
  slug, eventName, quotaShots, joinCode, previewMode,
  shotsLeft, bonusShots, queued, online, moment, onEmpty,
}: ViewfinderScreenProps) {
  const { videoRef, state, start, capture } = useCamera();
  const shot = useShot(slug);
  // Zero : obturateur au repos. Sinon, le numero du declenchement en cours.
  const [flashing, setFlashing] = useState(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [preview, setPreview] = useState<(PreparedImage & { url: string }) | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // « Le carton a disparu sous les verres » est le cas le plus frequent :
  // un invite deja entre depanne son voisin en lui montrant son ecran.
  const [partage, setPartage] = useState(false);

  // La camera est liberee au demontage par useCamera ; le minuteur, lui,
  // survivrait et appellerait setFlashing sur un composant demonte.
  useEffect(() => () => {
    clearTimeout(minuteur.current);
    clearTimeout(previewTimer.current);
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => { void start(); }, [start]);

  const total = shotsLeft + bonusShots;
  useEffect(() => { if (total === 0) onEmpty(); }, [total, onEmpty]);

  const takeShot = async () => {
    if (shot.isPending || preview || total === 0 || state !== 'ready') return;
    setCaptureError(null);

    // L'obturateur part avant l'attente reseau : le retour doit etre
    // immediat, sinon l'invite appuie deux fois. La cle change a chaque
    // declenchement pour que React remonte l'element et rejoue l'animation
    // — sans cela, deux poses rapprochees n'en montreraient qu'une.
    setFlashing((tour) => tour + 1);
    // Le retrait n'annule que le declenchement qu'il a lui-meme arme : deux
    // poses a moins de 340 ms d'ecart, et le premier minuteur couperait
    // l'animation de la seconde en plein vol.
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setFlashing(0), 340);

    try {
      const frame = await capture();
      if (previewMode === 'NONE') {
        shot.mutate(frame);
        return;
      }

      const prepared = await prepare(frame);
      const next = { ...prepared, url: previewUrl(prepared.blob) };
      setPreview(next);

      if (previewMode !== 'CONFIRM') {
        shot.mutate(prepared);
        previewTimer.current = setTimeout(() => setPreview(null), previewMode === 'FLASH' ? 2500 : 1200);
      }
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'La prise de vue a échoué.');
    }
  };

  const keepPreview = () => {
    if (!preview) return;
    shot.mutate({ blob: preview.blob, width: preview.width, height: preview.height });
    setPreview(null);
  };

  const retake = () => setPreview(null);

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

  // Le viseur ne passe pas par `Screen`, et c'est voulu. L'enveloppe commune
  // tient quatre choses — zones sures, largeur maximale, titre lu, bandes de
  // pellicule — et il les refuse toutes : ce qu'il lui faut a la place, c'est
  // un bloc positionne (le flux, l'obturateur et le panneau de partage se
  // calent en `absolute inset-0` dessus), une hauteur fixe, un fond noir et le
  // debordement decrit juste dessous. Une variante « plein cadre » de `Screen`
  // a existe pour lui ; elle ne portait aucun de ces quatre traits, donc elle
  // n'a jamais eu d'appelant. Elle a ete retiree plutot que completee : la
  // completer aurait fait entrer la mise en page du viseur dans l'enveloppe de
  // tous les autres ecrans, pour un seul appelant.
  //
  // pleine-largeur : le viseur deborde des bandes de pellicule. Le cadrage
  // prime ici sur la signature graphique — cinquante-deux pixels de moins,
  // c'est un visage coupe au bord de l'image.
  // Le fond du viseur reste noir, jamais `bg-well` : un carnet peut porter un
  // fond bleu nuit, et une bande teintee autour d'une image en fausse les
  // couleurs. Ce qui se pose PAR-DESSUS ce noir, en revanche, doit venir de la
  // famille `ink-well` : sinon le carnet Papier y peint son encre #1a1a18,
  // soit 1,20:1 de contraste — invisible.
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

      {flashing > 0 && (
        <div key={flashing} className="obturateur" aria-hidden="true">
          <span className="haute" />
          <span className="basse" />
          <span className="eclair" />
        </div>
      )}

      {preview && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black">
          <img
            src={preview.url}
            alt="Aperçu de la photographie"
            className={`min-h-0 flex-1 object-contain ${previewMode === 'BLURRED' ? 'scale-105 blur-xl' : ''}`}
          />
          {previewMode === 'CONFIRM' && (
            <div className="flex gap-3 bg-black px-5 pb-7 pt-4 safe-bottom">
              <button
                type="button"
                onClick={retake}
                className="min-h-12 flex-1 rounded-champ border border-white/35 text-sm font-semibold text-white"
              >
                Reprendre
              </button>
              <button
                type="button"
                onClick={keepPreview}
                className="min-h-12 flex-1 rounded-champ bg-white text-sm font-semibold text-black"
              >
                Garder
              </button>
            </div>
          )}
        </div>
      )}

      <header className="relative z-20 flex items-start justify-between gap-4 px-5 pt-4 safe-top">
        <div className="rounded-champ bg-black/50 px-4 py-2 backdrop-blur">
          <ShotCounter shotsLeft={shotsLeft} bonusShots={bonusShots} queued={queued} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="max-w-32 truncate rounded-full bg-black/50 px-3 py-1
            text-xs text-ink-well-2 backdrop-blur">
            {eventName}
          </span>
          <button
            type="button"
            onClick={() => setPartage(true)}
            aria-label="Montrer le code à quelqu’un"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/50
              text-ink-well backdrop-blur active:bg-black/70"
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
            bg-pap px-8 backdrop-blur"
          style={{ animation: 'fade 180ms ease-out' }}
        >
          <p className="text-center text-lecture leading-relaxed text-ink-2">
            Faites scanner cet écran. Votre voisin rejoint la même soirée,
            avec ses propres {quotaShots} poses.
          </p>
          {/* Le code est presente comme un tirage : bord blanc epais, comme
              sur le carton imprime. Le cadre porte l'identite, jamais le
              code. */}
          {/* Blanc pur, et pas un jeton : c'est la zone de silence du
                  code. Un appareil photo a besoin de ce contraste-la quel que
                  soit le carnet — meme raison qu'au sommet de QrCode.tsx. */}
              <div className="bg-white p-3 shadow-2xl">
            <QrCode
              value={`${publicAppOrigin()}/e/${slug}`}
              size={216}
              label={`Code de la soirée ${eventName}`}
            />
            <p className="mt-2 text-center font-mono text-sm font-bold tracking-[0.2em] text-black">
              {joinCode}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPartage(false)}
            className="min-h-12 rounded-champ border border-edge px-8 text-base font-semibold
              text-ink active:bg-appui"
          >
            Fermer
          </button>
        </div>
      )}

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
        {(shot.isError || captureError) && (
          <p role="alert" className="mx-6 rounded-carte bg-danger-doux px-4 py-2 text-sm text-danger">
            {captureError ?? shot.error?.message}
          </p>
        )}

        <button
          onClick={takeShot}
          disabled={shot.isPending || preview !== null || total === 0}
          aria-label={`Prendre une photo, ${total} restantes`}
          className="h-20 w-20 rounded-full bg-ink-well ring-4 ring-edge
            transition active:scale-95 disabled:opacity-40
            focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ink-well"
        >
          <span className="sr-only">Declencher</span>
        </button>
      </footer>
    </div>
  );
}
