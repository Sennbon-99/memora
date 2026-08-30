// apps/web/src/features/guest/screens/PublicAlbumScreen.tsx
// L'album par lien de partage.
//
// C'est la seule porte d'entree qui ne demande ni QR code ni pellicule :
// elle sert a l'invite qui a perdu son telephone, et a la famille qui
// n'etait pas la. Le lien porte un jeton, et l'hote peut y ajouter un
// code a six chiffres pour une soiree sensible.
//
// La visibilite reste decidee par le serveur, photographie par
// photographie : ce lien donne acces a l'album, pas a tout.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicAlbumApi, ApiError } from '../../../lib/api.js';
import { applyEventTheme } from '../../../lib/theme.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useEffect } from 'react';

export function PublicAlbumScreen() {
  const { token = '' } = useParams();
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);

  const { data, isPending, error } = useQuery({
    queryKey: ['public-album', token, submitted],
    queryFn: () => publicAlbumApi.read(token, submitted),
    enabled: !!token,
    retry: false,
  });

  const color = data?.event.color;
  useEffect(() => { if (color) applyEventTheme(color); }, [color]);

  if (isPending) return <Spinner label="Ouverture de l’album" />;

  if (error) {
    const failure = error as ApiError;
    // Un code est demande : ce n'est pas une erreur, c'est une porte.
    const needsCode = failure.code === 'CODE_REQUIRED' || failure.code === 'WRONG_CODE';

    if (needsCode) {
      return (
        <Screen
          title="Album protégé"
          subtitle="Les organisateurs ont ajouté un code à six chiffres."
          footer={
            <Button full disabled={code.length !== 6} onClick={() => setSubmitted(code)}>
              Ouvrir l’album
            </Button>
          }
        >
          <div className="mt-9">
            <Field
              label="Code d’accès"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center font-mono text-xl tracking-[0.4em]"
              error={failure.code === 'WRONG_CODE' ? 'Code incorrect.' : undefined}
            />
          </div>
        </Screen>
      );
    }

    return (
      <Screen
        title="Album introuvable"
        subtitle="Ce lien n’est plus valide, ou l’album a été effacé au bout de trente jours."
      >
        <span />
      </Screen>
    );
  }

  return (
    <Screen
      title={data.event.name}
      subtitle={`${data.photos.length} photographie${data.photos.length > 1 ? 's' : ''} de la soirée.`}
    >
      {data.photos.length === 0 ? (
        <p className="mt-14 text-center text-sm text-paper/45">
          L’album est vide pour le moment.
        </p>
      ) : (
        <ul className="mt-7 grid grid-cols-2 gap-2 pb-8">
          {data.photos.map((photo, index) => (
            <li
              key={photo.id}
              className="animate-[rise_.3s_ease_backwards] motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
            >
              <img
                src={photo.url}
                alt={`Photographie prise à ${new Date(photo.takenAt)
                  .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
