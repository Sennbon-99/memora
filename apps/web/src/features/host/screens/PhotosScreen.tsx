// apps/web/src/features/host/screens/PhotosScreen.tsx
// Onglet Photos : l'album de la soiree, tel qu'il sera publie.
//
// Le tri, lui, se fait pellicule par pellicule dans l'onglet Invites. Ici on
// regarde le resultat : ce qui est garde, ce qui est masque, ce qui attend
// encore d'etre trie.
//
// Le releve est une plaque de trois chiffres, en mono et en or. Les filtres
// sont des pastilles : ils trient un regard, ils ne comptent rien.

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicationScope } from '@memora/types';
import { albumApi, type AlbumPhoto, ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useEvent } from '../useEvents.js';
import { useRolls } from '../useRolls.js';
import { PublishSheet } from './PublishSheet.js';

/**
 * Compte ce qui attend d'etre publie.
 *
 * Une photographie est prete quand sa pellicule a ete triee et qu'elle n'a
 * ete ni masquee ni deja publiee. Les pellicules pas encore ouvertes sont
 * ecartees : publier ce que personne n'a regarde serait exactement ce que
 * le tri doit empecher.
 */
export function countReadyToPublish(
  photos: { rollId: string; status: string; published: boolean }[],
  rolls: { id: string; reviewed: boolean }[],
): number {
  const reviewed = new Set(rolls.filter((roll) => roll.reviewed).map((roll) => roll.id));
  return photos.filter((photo) =>
    reviewed.has(photo.rollId) && photo.status === 'UPLOADED' && !photo.published).length;
}

type Filter = 'kept' | 'hidden' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'kept', label: 'Gardées' },
  { value: 'hidden', label: 'Masquées' },
  { value: 'all', label: 'Toutes' },
];

/** Un chiffre du releve : mono et or, libelle en petites capitales. */
function Tally({ label, value, edge = '' }: { label: string; value: number; edge?: string }) {
  return (
    <div className={`px-3.5 py-2.5 ${edge}`}>
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/45">{label}</p>
      <p className="mt-1 font-mono text-xl leading-none font-medium tabular-nums text-gold">
        {value}
      </p>
    </div>
  );
}

export function PhotosScreen() {
  const { eventId = '' } = useParams();
  const [filter, setFilter] = useState<Filter>('kept');
  const [sheet, setSheet] = useState(false);
  const client = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: ['host', 'album', eventId],
    queryFn: () => albumApi.forHost(eventId),
    enabled: !!eventId,
    retry: false,
  });
  const { data: rollsData } = useRolls(eventId);
  const { data: eventData } = useEvent(eventId);

  const publish = useMutation({
    mutationFn: (scope?: PublicationScope) => albumApi.publishReviewed(eventId, scope),
    onSuccess: () => {
      setSheet(false);
      void client.invalidateQueries({ queryKey: ['host', 'album', eventId] });
      void client.invalidateQueries({ queryKey: ['host', 'event', eventId] });
    },
  });

  const photos: AlbumPhoto[] = data?.photos ?? [];
  const ready = countReadyToPublish(photos, rollsData?.rolls ?? []);
  const masked = photos.filter((photo) => photo.status === 'HIDDEN').length;
  const kept = photos.length - masked;
  // La portee n'est demandee qu'a la premiere publication.
  const firstTime = eventData?.event.state !== 'PUBLISHED';

  const shown = useMemo(() => {
    if (filter === 'all') return photos;
    return photos.filter((photo) =>
      filter === 'hidden' ? photo.status === 'HIDDEN' : photo.status === 'UPLOADED');
  }, [photos, filter]);

  if (isPending) return <Spinner label="Chargement de l’album" />;

  // L'album n'existe qu'apres la fermeture : le dire plutot que d'afficher
  // une grille vide, qui laisserait croire a une panne.
  if (error) {
    const closed = (error as ApiError).code === 'NOT_CLOSED';
    return (
      <Screen
        title={closed ? 'Album pas encore disponible' : 'Chargement impossible'}
        code={{ hautGauche: 'MEMORA 400', hautDroite: 'ALBUM', basGauche: 'EN ATTENTE' }}
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
      subtitle={`${photos.length} photographie${photos.length > 1 ? 's' : ''} déposée${photos.length > 1 ? 's' : ''}.`}
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${photos.length} VUES`,
        hautDroite: 'ALBUM',
        ...(ready > 0 ? { basDroite: `${ready} À PUBLIER` } : {}),
      }}
      footer={
        ready > 0 ? (
          <div className="flex flex-col gap-2">
            <Button
              full
              disabled={publish.isPending}
              onClick={() => (firstTime ? setSheet(true) : publish.mutate(undefined))}
            >
              {publish.isPending
                ? 'Publication…'
                : `Publier ${ready} photographie${ready > 1 ? 's' : ''}`}
            </Button>
            {publish.error && (
              <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
                {(publish.error as ApiError).message}
              </p>
            )}
          </div>
        ) : undefined
      }
    >
      {photos.length > 0 && (
        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl border border-gold/18
          bg-paper/4">
          <Tally label="Gardées" value={kept} edge="border-r border-gold/12" />
          <Tally label="Masquées" value={masked} edge="border-r border-gold/12" />
          <Tally label="À publier" value={ready} />
        </div>
      )}

      <div role="tablist" aria-label="Filtrer les photographies" className="mt-5 flex gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition
              ${filter === option.value
                ? 'border-gold/60 bg-gold/12 font-bold text-gold'
                : 'border-gold/18 text-paper/50'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-14 text-center text-sm text-paper/45">
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

      {sheet && (
        <PublishSheet
          count={ready}
          busy={publish.isPending}
          onCancel={() => setSheet(false)}
          onConfirm={(scope) => publish.mutate(scope)}
        />
      )}
    </Screen>
  );
}
