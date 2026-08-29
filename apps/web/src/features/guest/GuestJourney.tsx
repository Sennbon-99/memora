// apps/web/src/features/guest/GuestJourney.tsx
// Enchainement des ecrans de l'invite.
//
// L'etape n'est pas stockee : elle se deduit de l'etat de la pellicule.
// Un invite qui ferme son navigateur et revient retombe donc exactement la
// ou il en etait, sans qu'on ait rien a memoriser. C'est aussi ce qui rend
// impossible de sauter le consentement en manipulant l'adresse.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Screen } from '../../ui/Screen.js';
import { Spinner } from '../../ui/Spinner.js';
import { useGuestSession } from './useGuestSession.js';
import { useMoment } from './useMoment.js';
import { useOnline } from './useOnline.js';
import { AlbumScreen } from './screens/AlbumScreen.js';
import { ConsentScreen } from './screens/ConsentScreen.js';
import { DevelopmentScreen } from './screens/DevelopmentScreen.js';
import { EndOfRollScreen } from './screens/EndOfRollScreen.js';
import { IdentityScreen } from './screens/IdentityScreen.js';
import { ViewfinderScreen } from './screens/ViewfinderScreen.js';

export function GuestJourney() {
  const { slug = '' } = useParams();
  const { data, isPending, isError, error } = useGuestSession(slug);
  const { online, queued, refreshQueued } = useOnline();
  const { moment, published } = useMoment(slug, undefined);

  // Les deux seules etapes qui ne se deduisent pas du serveur : l'identite,
  // que l'invite peut passer, et l'album, qu'il choisit d'ouvrir.
  const [identityDone, setIdentityDone] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [seenEnd, setSeenEnd] = useState(false);

  if (isPending) return <Spinner label="Ouverture de votre pellicule" />;

  if (isError) {
    return (
      <Screen
        title="Evenement introuvable"
        subtitle="Ce lien n'est plus valide, ou la soiree est terminee depuis plus de trente jours."
      >
        <p className="mt-8 text-sm text-white/40">{error.message}</p>
      </Screen>
    );
  }

  const { roll, event } = data;

  if (!roll.hasConsented) {
    return (
      <ConsentScreen slug={slug} eventName={event.name} welcomeMessage={event.welcomeMessage} />
    );
  }

  if (!identityDone && roll.firstName === null && roll.shotsLeft === event.quotaShots) {
    return (
      <IdentityScreen
        slug={slug}
        useTableCodes={event.useTableCodes}
        onDone={() => setIdentityDone(true)}
      />
    );
  }

  // L'album est ouvert soit parce que l'hote vient de publier — message
  // temps reel —, soit parce qu'il avait publie avant que l'invite revienne.
  const albumReady = published || event.albumPublished;

  if (showAlbum) return <AlbumScreen firstName={roll.firstName} />;

  // La soiree est finie : l'invite ne photographie plus, il attend.
  if (event.state !== 'OPEN' || roll.shotsLeft + roll.bonusShots === 0) {
    // Un premier passage propose le code de recuperation ; les suivants
    // montrent directement l'attente, sans reposer la meme question.
    if (!seenEnd && roll.shotsLeft + roll.bonusShots === 0 && event.state === 'OPEN') {
      return (
        <EndOfRollScreen
          slug={slug}
          firstName={roll.firstName}
          queued={queued}
          albumReady={albumReady}
          onSeeAlbum={() => (albumReady ? setShowAlbum(true) : setSeenEnd(true))}
        />
      );
    }

    return (
      <DevelopmentScreen
        hostLabel="Les mariés"
        queued={queued}
        albumReady={albumReady}
        onSeeAlbum={() => setShowAlbum(true)}
      />
    );
  }

  return (
    <ViewfinderScreen
      slug={slug}
      eventName={event.name}
      shotsLeft={roll.shotsLeft}
      bonusShots={roll.bonusShots}
      queued={queued}
      online={online}
      moment={moment}
      onEmpty={() => void refreshQueued()}
    />
  );
}
