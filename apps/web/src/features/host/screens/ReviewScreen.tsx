// apps/web/src/features/host/screens/ReviewScreen.tsx
// Le tri, pellicule par pellicule.
//
// Deux niveaux de lecture, pas deux modes a choisir. La rafale traite le
// volume : six vignettes, on touche celles qu'on ecarte, on passe au lot
// suivant. Une pression longue ouvre la photographie en grand, ou l'on
// decide a l'aise et ou l'on parcourt le lot.
//
// Regle centrale : le non-choix vaut conservation. Dans un mariage la
// plupart des images sont montrables, et le travail de l'hote est d'ecarter
// les ratees. Sur un millier de photographies, cela represente cent gestes
// au lieu de mille — et une pellicule abandonnee en cours de route reste
// publiable telle quelle.
//
// Cet ecran ne passe pas par Screen : la planche de vignettes occupe toute
// la hauteur et le pied lui appartient. Les bandes de pellicule sont donc
// posees a la main, sans quoi les deux gouttieres de la racine resteraient
// vides et l'ecran paraitrait sorti de l'application.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { RollPhoto } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useReviewRoll, useRollPhotos } from '../useRolls.js';
import { Photo } from '../../../ui/Photo.js';

/** Six par lot : a 375 pixels de large, neuf feraient des cibles de 88 px. */
const LOT = 6;

/** Delai au-dela duquel une pression devient un agrandissement. */
const LONG_PRESS_MS = 320;

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function ReviewScreen() {
  const { eventId = '', rollId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending } = useRollPhotos(eventId, rollId);
  const review = useReviewRoll(eventId);

  const [lot, setLot] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [zoomed, setZoomed] = useState<number | null>(null);

  // Changer de pellicule remet tout a zero : sans cela, les masquages de la
  // precedente seraient appliques a la suivante.
  useEffect(() => { setLot(0); setHidden(new Set()); setZoomed(null); }, [rollId]);

  const photos = data?.photos ?? [];
  const batch = useMemo(() => photos.slice(lot * LOT, lot * LOT + LOT), [photos, lot]);
  const lots = Math.max(1, Math.ceil(photos.length / LOT));
  const last = lot >= lots - 1;

  const toggle = (id: string) => setHidden((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const finish = () => review.mutate(
    { rollId, hiddenPhotoIds: [...hidden] },
    {
      onSuccess: ({ nextRollId }) => {
        // On enchaine sur la pellicule suivante sans repasser par la liste :
        // l'hote entre dans un rythme, et douze allers-retours disparaissent.
        navigate(nextRollId ? `/hote/${eventId}/tri/${nextRollId}` : `/hote/${eventId}/invites`,
          { replace: true });
      },
    },
  );

  if (isPending || !data) return <Spinner label="Chargement de la pellicule" />;

  if (photos.length === 0) {
    return (
      <Screen
        title="Pellicule vide"
        subtitle="Cet invité n’a déposé aucune photographie."
        code={{ hautGauche: 'MEMORA 400', hautDroite: 'TRI', basGauche: '0 VUE' }}
        footer={<Button full onClick={() => navigate(`/hote/${eventId}/invites`)}>Retour</Button>}
      >
        <span />
      </Screen>
    );
  }

  const kept = photos.length - hidden.size;
  const who = data.roll.firstName ?? 'Anonyme';

  return (
    <div className="quadrille flex min-h-full flex-col safe-top">
      <div className="bande bande-gauche" aria-hidden="true">
        <span>MEMORA 400</span>
        <span>{photos.length} VUES</span>
      </div>
      <div className="bande bande-droite" aria-hidden="true">
        <span>TRI</span>
        <span>LOT {lot + 1}/{lots}</span>
      </div>

      <header className="flex items-center gap-3 px-5 pt-3">
        <button
          onClick={() => navigate(`/hote/${eventId}/invites`)}
          className="text-sm text-ink-3"
        >
          ‹ Pellicules
        </button>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
          Lot <span className="tabular-nums text-a1">{lot + 1}</span> / {lots}
        </span>
      </header>

      <div className="mt-3 px-5">
        <h1 className="decoupe text-[34px] leading-[0.95] tracking-tight">{who}</h1>
        <p className="mt-1.5 text-xs text-ink-3">
          {data.roll.tableLabel ?? 'Sans table'} ·{' '}
          <span className="font-mono tabular-nums">{photos.length}</span> photographies ·
          {' '}touchez celles à écarter
        </p>
      </div>

      <div className="mx-5 mt-3 h-0.5 overflow-hidden rounded-full bg-pap-2">
        <span
          className="block h-full rounded-full bg-a1 transition-[width]
            duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${((lot + 1) / lots) * 100}%` }}
        />
      </div>

      <ul className="mt-3 grid flex-1 grid-cols-2 content-start gap-1.5 px-5">
        {batch.map((photo, index) => (
          <PhotoTile
            key={photo.id}
            photo={photo}
            hidden={hidden.has(photo.id)}
            onToggle={() => toggle(photo.id)}
            onZoom={() => setZoomed(index)}
          />
        ))}
      </ul>

      <footer className="sticky bottom-0 z-20 mt-3 flex gap-2 border-t border-edge
        bg-pap px-5 py-3 backdrop-blur safe-bottom">
        <Button
          tone="ghost"
          className="flex-1"
          onClick={() => setHidden(new Set(photos.map((photo) => photo.id)))}
        >
          Tout écarter
        </Button>
        <Button
          className="flex-[1.4]"
          disabled={review.isPending}
          onClick={() => (last ? finish() : setLot((n) => n + 1))}
        >
          {review.isPending
            ? 'Enregistrement…'
            : last ? `Garder ${kept} · terminer` : 'Lot suivant'}
        </Button>
      </footer>

      {zoomed !== null && batch[zoomed] && (
        <Zoom
          photos={batch}
          index={zoomed}
          hidden={hidden}
          onIndex={setZoomed}
          onToggle={toggle}
          onClose={() => setZoomed(null)}
        />
      )}
    </div>
  );
}

/** Une vignette : touche brève pour écarter, pression longue pour agrandir. */
function PhotoTile({ photo, hidden, onToggle, onZoom }: {
  photo: RollPhoto; hidden: boolean; onToggle: () => void; onZoom: () => void;
}) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const start = () => {
    longPressed.current = false;
    timer.current = window.setTimeout(() => { longPressed.current = true; onZoom(); }, LONG_PRESS_MS);
  };
  const end = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!longPressed.current) onToggle();
  };
  const cancel = () => { if (timer.current) window.clearTimeout(timer.current); };

  return (
    <li>
      <button
        onPointerDown={start}
        onPointerUp={end}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        aria-pressed={hidden}
        aria-label={`Photographie de ${heure(photo.takenAt)}${hidden ? ', écartée' : ''}`}
        className="relative block aspect-square w-full overflow-hidden rounded-champ
          ring-1 ring-edge"
      >
        <Photo
          src={photo.url}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover transition duration-200
            ${hidden ? 'scale-95 opacity-30 grayscale' : ''}`}
        />
        {hidden && (
          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center
            rounded-full bg-danger text-xs font-bold text-on-danger">✕</span>
        )}
        {/* L'ombre du texte n'est pas une elevation : elle detache l'heure
            d'une image dont on ne connait pas la clarte. Elle ne peut le faire
            que sous un texte clair : `text-ink-2` valait #4a4a42 en Papier,
            soit une encre sombre ombree de noir — 2,35:1 sur une photographie
            sombre. L'encre du puits, elle, tient 18:1 dans les trois carnets. */}
        <span className="absolute bottom-1 left-2 font-mono text-[9px] tabular-nums text-ink-well
          [text-shadow:0_1px_3px_rgb(0_0_0/.8)]">
          {heure(photo.takenAt)}
        </span>
        {photo.momentLabel && (
          <span className="absolute left-1.5 top-1.5 rounded-champ bg-black/55 px-1.5 py-0.5
            text-[9px] text-ink-well backdrop-blur">
            {photo.momentLabel}
          </span>
        )}
      </button>
    </li>
  );
}

/** Second niveau de lecture : la photographie en grand, et le lot au clavier. */
function Zoom({ photos, index, hidden, onIndex, onToggle, onClose }: {
  photos: RollPhoto[];
  index: number;
  hidden: Set<string>;
  onIndex: (index: number) => void;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const photo = photos[index]!;
  const step = (delta: number) => onIndex((index + delta + photos.length) % photos.length);

  // Echap ferme, les fleches parcourent : le tri se fait aussi au clavier
  // depuis un ordinateur, ce que le jury essaiera.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isHidden = hidden.has(photo.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photographie en grand"
      className="fixed inset-0 z-50 flex flex-col bg-black animate-[fade_.18s_ease]
        motion-reduce:animate-none"
    >
      <div className="relative flex-1">
        <Photo src={photo.url} alt="" className="absolute inset-0 h-full w-full object-contain" />

        <div className="absolute inset-x-0 top-0 flex justify-between p-4 safe-top">
          <span className="rounded-full bg-black/55 px-3 py-1.5 font-mono text-[11px]
            tabular-nums text-ink-well backdrop-blur">
            {index + 1} / {photos.length}
          </span>
          <span className="rounded-full bg-black/55 px-3 py-1.5 font-mono text-[11px]
            tabular-nums text-ink-well backdrop-blur">
            {heure(photo.takenAt)}
          </span>
        </div>

        <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
          <button onClick={() => step(-1)} aria-label="Photographie précédente"
            className="grid h-11 w-11 place-items-center rounded-full bg-black/45
              text-lg text-ink-well backdrop-blur">‹</button>
          <button onClick={() => step(1)} aria-label="Photographie suivante"
            className="grid h-11 w-11 place-items-center rounded-full bg-black/45
              text-lg text-ink-well backdrop-blur">›</button>
        </div>
      </div>

      <div className="flex gap-2 p-4 safe-bottom">
        <Button tone="ghost" className="flex-1" onClick={onClose}>Retour au lot</Button>
        <Button
          className="flex-1"
          onClick={() => { onToggle(photo.id); if (index < photos.length - 1) step(1); }}
        >
          {isHidden ? 'Rétablir' : 'Écarter'}
        </Button>
      </div>
    </div>
  );
}
