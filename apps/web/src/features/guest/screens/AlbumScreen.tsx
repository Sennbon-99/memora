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

  // L'attente reste dans l'enveloppe : un indicateur pose seul perdrait les
  // bandes de pellicule, et l'application clignoterait a chaque chargement.
  if (isPending) {
    return (
      <Screen
        title="Album"
        hideTitle
        code={{ hautGauche: 'MEMORA 400', basGauche: 'ALBUM', hautDroite: 'OUVERTURE' }}
      >
        <div className="flex flex-1 items-center justify-center">
          <Spinner label="Chargement de l'album" />
        </div>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen
        title="Album indisponible"
        subtitle="Vérifiez votre connexion, puis rechargez la page."
        code={{ hautGauche: 'MEMORA 400', basGauche: 'ALBUM', hautDroite: 'HORS LIGNE' }}
      >
        <div className="flex flex-1 flex-col justify-center pb-16">
          <div className="rounded-carte border border-edge bg-pap-2 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
              Planche indisponible
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Vos photographies sont conservées trente jours : rien n’est perdu,
              l’album se rouvrira au retour du réseau.
            </p>
          </div>
        </div>
      </Screen>
    );
  }

  const photos = data.photos;

  return (
    <Screen
      title={firstName ? `Vos photos, ${firstName}` : 'Vos photos'}
      subtitle="Ce que l’organisateur a publié de la soirée."
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${photos.length} VUES`,
        hautDroite: 'ALBUM',
      }}
    >
      {photos.length === 0 ? (
        // La planche vide occupe la hauteur au lieu d'y flotter : une ligne
        // centree perdue au milieu de l'ecran ressemble a une panne.
        <div className="flex flex-1 flex-col justify-center pb-16">
          <div className="rounded-carte border border-edge bg-pap-2 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
              Planche vide
            </p>
            <h2 className="mt-3 font-serif text-[26px] leading-[1.15]">
              Rien à montrer pour l’instant.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              L’organisateur n’a pas encore publié sa sélection de la soirée.
              Revenez dans un jour ou deux.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 flex items-baseline justify-between border-b border-edge pb-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
              Planche contact
            </p>
            <p className="font-mono text-[12px] tabular-nums text-ink-3">
              <span className="text-a1">{photos.length}</span>{' '}
              {photos.length > 1 ? 'photographies' : 'photographie'}
            </p>
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-2 pb-10">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="relative animate-[rise_.3s_ease_backwards] motion-reduce:animate-none"
                style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
              >
                <img
                  src={photo.url}
                  alt={`Photographie prise le ${new Date(photo.takenAt).toLocaleString('fr-FR')}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-champ bg-pap-2 object-cover"
                />
                {done.includes(photo.id) ? (
                  <span className="absolute inset-x-1.5 bottom-1.5 rounded-champ bg-pap px-2
                    py-1 text-center font-mono text-[9px] uppercase tracking-[0.16em]
                    text-a1 backdrop-blur">
                    Retrait demandé
                  </span>
                ) : (
                  <button
                    onClick={() => setAsking(photo.id)}
                    aria-label="Demander le retrait de cette photographie"
                    className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center
                      rounded-full bg-pap text-sm text-ink backdrop-blur"
                  >
                    ⋯
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
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
            className="absolute inset-0 bg-pap animate-[fade_.2s_ease] motion-reduce:animate-none"
          />
          <div className="relative m-3 rounded-carte border border-edge bg-well p-5
            animate-[rise_.26s_cubic-bezier(.2,.8,.2,1)] motion-reduce:animate-none safe-bottom">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
              Droit à l’image
            </p>
            <h2 className="mt-2 font-serif text-[26px] leading-tight">Demander le retrait</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
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
                className="w-full rounded-champ bg-pap-2 p-3.5 text-sm text-ink
                  placeholder:text-ink-3 focus:outline-2 focus:outline-a1"
              />
            </label>

            {request.error && (
              <p role="alert" className="mt-2 text-xs text-danger">
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
