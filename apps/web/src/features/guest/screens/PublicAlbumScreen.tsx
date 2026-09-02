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

import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicAlbumApi, ApiError } from '../../../lib/api.js';
import { applyCarnet } from '../../../lib/theme.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { Photo } from '../../../ui/Photo.js';

export function PublicAlbumScreen() {
  /** Angle de pose d'un tirage. Cinq valeurs qui se repetent : deux vues
   *  voisines ne sont jamais alignees, et la planche ne part pas en
   *  travers. La rotation est lue par .tirage via --pose-angle. */
  const pose = (index: number) => `${[-0.6, 0.45, -0.3, 0.7, -0.45][index % 5]}deg`;

  const { token = '' } = useParams();
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);

  const { data, isPending, error } = useQuery({
    queryKey: ['public-album', token, submitted],
    queryFn: () => publicAlbumApi.read(token, submitted),
    enabled: !!token,
    retry: false,
  });

  const carnet = data?.event.carnet;
  useEffect(() => { applyCarnet(carnet); }, [carnet]);

  // L'attente garde l'enveloppe : les bandes de pellicule ne doivent pas
  // disparaitre le temps que l'album arrive.
  if (isPending) {
    return (
      <Screen
        title="Album"
        hideTitle
        code={{ hautGauche: 'MEMORA 400', basGauche: 'ALBUM', hautDroite: 'OUVERTURE' }}
      >
        <div className="flex flex-1 items-center justify-center">
          <Spinner label="Ouverture de l’album" />
        </div>
      </Screen>
    );
  }

  if (error) {
    const failure = error as ApiError;
    // Un code est demande : ce n'est pas une erreur, c'est une porte.
    const needsCode = failure.code === 'CODE_REQUIRED' || failure.code === 'WRONG_CODE';

    if (needsCode) {
      return (
        <Screen
          title="Album protégé"
          subtitle="Les organisateurs ont ajouté un code à six chiffres."
          code={{
            hautGauche: 'MEMORA 400',
            basGauche: 'ALBUM',
            hautDroite: 'CODE REQUIS',
          }}
          footer={
            <Button full disabled={code.length !== 6} onClick={() => setSubmitted(code)}>
              Ouvrir l’album
            </Button>
          }
        >
          <div className="flex flex-1 flex-col justify-between pb-6 pt-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
              Lien de partage
            </p>

            <div className="border-y border-edge py-6">
              <p className="max-w-[22ch] decoupe text-[26px] leading-[1.15] text-ink-2">
                Six chiffres séparent cet album de vous.
              </p>
            </div>

            <div className="rounded-carte border border-edge bg-pap-2 shadow-[var(--ombre-tirage)] p-6">
              <Field
                label="Code d’accès"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center font-mono text-xl tabular-nums tracking-[0.4em]"
                error={failure.code === 'WRONG_CODE' ? 'Code incorrect.' : undefined}
              />
            </div>
          </div>
        </Screen>
      );
    }

    return (
      <Screen
        title="Album introuvable"
        subtitle="Ce lien n’est plus valide, ou l’album a été effacé au bout de trente jours."
        code={{
          hautGauche: 'MEMORA 400',
          basGauche: 'ALBUM',
          hautDroite: 'LIEN EXPIRÉ',
        }}
      >
        <div className="flex flex-1 flex-col justify-center pb-16">
          <div className="rounded-carte border border-edge bg-pap-2 shadow-[var(--ombre-tirage)] p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
              Pellicule effacée
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Un album Memora vit trente jours, puis s’efface : c’est la
              promesse faite aux invités le soir de la soirée. Demandez un
              nouveau lien à l’organisateur.
            </p>
          </div>
        </div>
      </Screen>
    );
  }

  const photos = data.photos;

  return (
    <Screen
      title={data.event.name}
      titreRepliable
      subtitle="Les photographies publiées par l’organisateur."
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${photos.length} VUES`,
        hautDroite: 'ALBUM PARTAGÉ',
      }}
    >
      {photos.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center pb-16">
          <div className="rounded-carte border border-edge bg-pap-2 shadow-[var(--ombre-tirage)] p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
              Planche vide
            </p>
            <h2 className="mt-3 decoupe text-[26px] leading-[1.15]">
              L’album est vide pour le moment.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Les photographies apparaîtront ici dès que l’organisateur aura
              publié sa sélection.
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

          <ul className="mt-4 grid grid-cols-2 gap-2 pb-8">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="tirage relative animate-[rise_.3s_ease_backwards]
                  motion-reduce:animate-none"
                style={{
                  animationDelay: `${Math.min(index, 10) * 30}ms`,
                  '--pose-angle': pose(index),
                } as CSSProperties}
              >
                <Photo
                  src={photo.url}
                  alt={`Photographie prise à ${new Date(photo.takenAt)
                    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
