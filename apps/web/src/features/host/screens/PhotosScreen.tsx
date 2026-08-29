// apps/web/src/features/host/screens/PhotosScreen.tsx
// Onglet Photos : l'album de la soiree, tel qu'il sera publie.
//
// Le tri, lui, se fait pellicule par pellicule dans l'onglet Invites. Ici on
// regarde le resultat : ce qui est garde, ce qui est masque, ce qui attend
// encore d'etre trie.

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { albumApi, type AlbumPhoto, ApiError } from '../../../lib/api.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';

type Filter = 'kept' | 'hidden' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'kept', label: 'Gardées' },
  { value: 'hidden', label: 'Masquées' },
  { value: 'all', label: 'Toutes' },
];

export function PhotosScreen() {
  const { eventId = '' } = useParams();
  const [filter, setFilter] = useState<Filter>('kept');

  const { data, isPending, error } = useQuery({
    queryKey: ['host', 'album', eventId],
    queryFn: () => albumApi.forHost(eventId),
    enabled: !!eventId,
    retry: false,
  });

  const shown = useMemo(() => {
    if (!data) return [] as AlbumPhoto[];
    if (filter === 'all') return data;
    return data.filter((photo) =>
      filter === 'hidden' ? photo.status === 'HIDDEN' : photo.status === 'UPLOADED');
  }, [data, filter]);

  if (isPending) return <Spinner label="Chargement de l’album" />;

  // L'album n'existe qu'apres la fermeture : le dire plutot que d'afficher
  // une grille vide, qui laisserait croire a une panne.
  if (error) {
    const closed = (error as ApiError).code === 'NOT_CLOSED';
    return (
      <Screen
        title={closed ? 'Album pas encore disponible' : 'Chargement impossible'}
        subtitle={
          closed
            ? 'Les photographies apparaîtront ici dès que vous aurez fermé la pellicule.'
            : (error as ApiError).message
        }
      >
        <span />
      </Screen>
    );
  }

  return (
    <Screen
      title="Photos"
      subtitle={`${data.length} photographie${data.length > 1 ? 's' : ''} déposée${data.length > 1 ? 's' : ''}.`}
    >
      <div role="tablist" aria-label="Filtrer les photographies" className="mt-5 flex gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition
              ${filter === option.value
                ? 'border-[var(--accent)] bg-[var(--accent)] font-bold text-[var(--accent-text)]'
                : 'border-white/12 text-white/50'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-14 text-center text-sm text-white/45">
          {filter === 'hidden' ? 'Aucune photographie masquée.' : 'Rien à montrer ici.'}
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-1 pb-6">
          {shown.map((photo, index) => (
            <li
              key={photo.id}
              className="animate-[rise_.3s_ease_backwards] motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(index, 12) * 22}ms` }}
            >
              <img
                src={photo.url}
                alt={`Photographie prise à ${new Date(photo.takenAt)
                  .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                loading="lazy"
                className={`aspect-square w-full rounded-lg object-cover
                  ${photo.status === 'HIDDEN' ? 'opacity-35 grayscale' : ''}`}
              />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
