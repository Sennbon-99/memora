import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const deliver = async (mode: 'save' | 'share') => {
    setBusy(mode);
    setError(null);
    try {
      const file = await photoFile(photo);
      const share = await canShareFile(file);
      // Dans l'application native, la feuille systeme est aussi le chemin
      // fiable vers « Enregistrer l'image ». Sur le web, le bouton Enregistrer
      // garde le telechargement direct attendu.
      if (mode === 'share' || (mode === 'save' && Capacitor.isNativePlatform())) {
        if (share) {
          await navigator.share({ files: [file], title: 'Photographie Memora' });
        } else {
          saveInBrowser(file);
        }
      } else {
        saveInBrowser(file);
      }
    } catch (cause) {
      if ((cause as { name?: string }).name !== 'AbortError') {
        setError(cause instanceof Error ? cause.message : 'Cette action a échoué.');
      }
    } finally {
      setBusy(null);
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
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void deliver('save')}
            className="min-h-12 flex-1 rounded-champ bg-white font-semibold text-black disabled:opacity-50"
          >
            {busy === 'save' ? 'Préparation…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void deliver('share')}
            className="min-h-12 flex-1 rounded-champ border border-white/35 font-semibold disabled:opacity-50"
          >
            {busy === 'share' ? 'Préparation…' : 'Partager'}
          </button>
        </div>
      </footer>
    </div>
  );
}
