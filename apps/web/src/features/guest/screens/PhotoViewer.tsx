import { useEffect, useRef, useState } from 'react';
import { Photo } from '../../../ui/Photo.js';

export interface ViewablePhoto {
  id: string;
  url: string;
  takenAt: string;
}

async function photoFile(photo: ViewablePhoto): Promise<File> {
  const response = await fetch(photo.url);
  if (!response.ok) throw new Error('La photographie ne peut pas être téléchargée.');
  const blob = await response.blob();
  const stamp = new Date(photo.takenAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return new File([blob], `memora-${stamp}.jpg`, { type: blob.type || 'image/jpeg' });
}

function saveInBrowser(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function canShareFile(file: File): Promise<boolean> {
  return typeof navigator.share === 'function'
    && (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));
}

export function PhotoViewer({ photos, index, onIndex, onClose }: {
  photos: ViewablePhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // L'indication ne vaut que la ou une feuille systeme existe : sur un
  // navigateur de bureau, elle designerait un menu que personne ne verra.
  const systemSheet = typeof navigator.share === 'function';
  const touchStart = useRef<number | null>(null);
  const photo = photos[index];

  const move = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < photos.length) onIndex(next);
  };

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });

  if (!photo) return null;

  /**
   * Un seul geste, parce qu'il n'y en a qu'un de possible.
   *
   * Aucune interface web n'ecrit dans la phototheque du telephone : la
   * feuille de partage du systeme est le seul chemin vers « Enregistrer
   * l'image », y compris depuis une page ouverte dans Safari. Un bouton
   * « Enregistrer » qui declencherait un telechargement direct deposerait la
   * photographie dans Fichiers, la ou personne ne va la chercher.
   *
   * Le telechargement reste le repli des navigateurs de bureau, qui n'ont pas
   * de feuille de partage.
   */
  const deliver = async () => {
    setBusy(true);
    setError(null);
    try {
      const file = await photoFile(photo);
      if (await canShareFile(file)) {
        await navigator.share({ files: [file], title: 'Photographie Memora' });
      } else {
        saveInBrowser(file);
      }
    } catch (cause) {
      if ((cause as { name?: string }).name !== 'AbortError') {
        setError(cause instanceof Error ? cause.message : 'Cette action a échoué.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photographie en plein écran"
      className="fixed inset-0 z-[70] flex flex-col bg-black text-white safe-top safe-bottom"
      onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined && Math.abs(end - start) > 55) {
          move(end > start ? -1 : 1);
        }
        touchStart.current = null;
      }}
    >
      <header className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-full bg-white/12 px-4 text-sm font-semibold"
        >
          Fermer
        </button>
        <p className="font-mono text-xs tabular-nums text-white/75">
          {index + 1} / {photos.length}
        </p>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <Photo
          key={photo.id}
          src={photo.url}
          alt={`Photographie prise le ${new Date(photo.takenAt).toLocaleString('fr-FR')}`}
          className="max-h-full max-w-full object-contain"
        />
        {index > 0 && (
          <button
            type="button"
            aria-label="Photographie précédente"
            onClick={() => move(-1)}
            className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-2xl"
          >‹</button>
        )}
        {index < photos.length - 1 && (
          <button
            type="button"
            aria-label="Photographie suivante"
            onClick={() => move(1)}
            className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-2xl"
          >›</button>
        )}
      </div>

      <footer className="px-4 pb-4 pt-3">
        {error && <p role="alert" className="mb-2 text-center text-xs text-red-300">{error}</p>}
        <div className="mx-auto max-w-md">
          <button
            type="button"
            disabled={busy}
            onClick={() => void deliver()}
            className="min-h-12 w-full rounded-champ bg-white font-semibold text-black disabled:opacity-50"
          >
            {busy ? 'Préparation…' : 'Enregistrer ou partager'}
          </button>
          {systemSheet && (
            <p className="mt-2 text-center text-xs text-white/60">
              Choisissez « Enregistrer l'image » pour l'ajouter à vos photos.
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
