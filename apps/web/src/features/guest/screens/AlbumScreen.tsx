// apps/web/src/features/guest/screens/AlbumScreen.tsx
// L'album, une fois que l'hote a publie.
//
// Ce que l'invite voit ici depend de la portee choisie par l'hote, et ce
// filtrage est fait cote serveur par canSeePhoto : le client affiche ce
// qu'on lui envoie, il ne decide rien.

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { photoApi, ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';

export function AlbumScreen({ firstName }: { firstName: string | null }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<string[]>([]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['my-photos'],
    queryFn: photoApi.mine,
  });

  // Le droit d'opposition du RGPD, exerce par l'invite lui-meme. La demande
  // n'efface rien : elle est transmise a l'hote, qui tranche. Effacer
  // directement laisserait n'importe quel invite retirer les photographies
  // des autres.
  const request = useMutation({
    mutationFn: ({ photoId, why }: { photoId: string; why: string }) =>
      photoApi.requestRemoval(photoId, why),
    onSuccess: (_result, { photoId }) => {
      setDone((was) => [...was, photoId]);
      setAsking(null);
      setReason('');
    },
  });

  if (isPending) return <Spinner label="Chargement de l'album" />;

  if (isError) {
    return (
      <Screen title="Album indisponible" subtitle="Vérifiez votre connexion et rechargez la page.">
        <span />
      </Screen>
    );
  }

  const photos = data.photos;

  return (
    <Screen
      title={firstName ? `Vos photos, ${firstName}` : 'Vos photos'}
      subtitle={`${photos.length} ${photos.length > 1 ? 'images' : 'image'} de la soiree.`}
    >
      {photos.length === 0 ? (
        <p className="mt-12 text-center text-sm text-white/50">
          Rien à montrer pour l'instant. Les mariés n'ont pas encore publié.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-2 pb-10">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <img
                src={photo.url}
                alt={`Photographie prise le ${new Date(photo.takenAt).toLocaleString('fr-FR')}`}
                loading="lazy"
                className="aspect-square w-full rounded-xl bg-white/5 object-cover"
              />
              {done.includes(photo.id) ? (
                <span className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-black/70 px-2
                  py-1 text-center text-[10px] text-white backdrop-blur">
                  Retrait demandé
                </span>
              ) : (
                <button
                  onClick={() => setAsking(photo.id)}
                  aria-label="Demander le retrait de cette photographie"
                  className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center
                    rounded-full bg-black/55 text-sm text-white backdrop-blur"
                >
                  ⋯
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {asking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Demander un retrait"
          className="fixed inset-0 z-50 flex flex-col justify-end"
        >
          <button
            aria-label="Annuler"
            onClick={() => setAsking(null)}
            className="absolute inset-0 bg-black/60 animate-[fade_.2s_ease] motion-reduce:animate-none"
          />
          <div className="relative m-3 rounded-3xl border border-white/10 bg-[#252119] p-5
            animate-[rise_.26s_cubic-bezier(.2,.8,.2,1)] motion-reduce:animate-none safe-bottom">
            <h2 className="text-lg font-extrabold tracking-tight">Demander le retrait</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
              Votre demande est transmise à l’organisateur, qui décide. Dites
              en quelques mots pourquoi.
            </p>

            <label className="mt-4 block">
              <span className="sr-only">Raison</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Je préfère ne pas apparaître sur cette photographie."
                className="w-full rounded-2xl bg-white/7 p-3.5 text-sm text-paper
                  placeholder:text-white/25 focus:outline-2 focus:outline-[var(--accent)]"
              />
            </label>

            {request.error && (
              <p role="alert" className="mt-2 text-xs text-red-300">
                {(request.error as ApiError).message}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <Button tone="ghost" className="flex-1" onClick={() => setAsking(null)}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                disabled={reason.trim().length < 3 || request.isPending}
                onClick={() => request.mutate({ photoId: asking, why: reason.trim() })}
              >
                {request.isPending ? 'Envoi…' : 'Envoyer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
