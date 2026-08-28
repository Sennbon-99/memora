// apps/web/src/features/guest/screens/AlbumScreen.tsx
// L'album, une fois que l'hote a publie.
//
// Ce que l'invite voit ici depend de la portee choisie par l'hote, et ce
// filtrage est fait cote serveur par canSeePhoto : le client affiche ce
// qu'on lui envoie, il ne decide rien.

import { useQuery } from '@tanstack/react-query';
import { photoApi } from '../../../lib/api.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';

export function AlbumScreen({ firstName }: { firstName: string | null }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['my-photos'],
    queryFn: photoApi.mine,
  });

  if (isPending) return <Spinner label="Chargement de l'album" />;

  if (isError) {
    return (
      <Screen title="Album indisponible" subtitle="Verifiez votre connexion et rechargez la page.">
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
          Rien a montrer pour l'instant. Les maries n'ont pas encore publie.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-2 pb-10">
          {photos.map((photo) => (
            <li key={photo.id} className="aspect-square overflow-hidden rounded-xl bg-white/5">
              <img
                src={photo.url}
                alt={`Photographie prise le ${new Date(photo.takenAt).toLocaleString('fr-FR')}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
