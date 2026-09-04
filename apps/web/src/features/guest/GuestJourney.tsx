// apps/web/src/features/guest/GuestJourney.tsx
// Enchainement des ecrans de l'invite.
//
// L'etape n'est pas stockee : elle se deduit de l'etat de la pellicule.
// Un invite qui ferme son navigateur et revient retombe donc exactement la
// ou il en etait, sans qu'on ait rien a memoriser. C'est aussi ce qui rend
// impossible de sauter le consentement en manipulant l'adresse.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, guestApi } from '../../lib/api.js';
import { Screen } from '../../ui/Screen.js';
import { Spinner } from '../../ui/Spinner.js';
import { sessionKey, useGuestSession } from './useGuestSession.js';
import { useMoment } from './useMoment.js';
import { Onboarding, presentationVue } from '../onboarding/Onboarding.js';
import { useOnline } from './useOnline.js';
import { AlbumScreen } from './screens/AlbumScreen.js';
import { ConsentScreen } from './screens/ConsentScreen.js';
import { DevelopmentScreen } from './screens/DevelopmentScreen.js';
import { EndOfRollScreen } from './screens/EndOfRollScreen.js';
import { IdentityScreen } from './screens/IdentityScreen.js';
import { ViewfinderScreen } from './screens/ViewfinderScreen.js';
import type { PublicationScope } from '@memora/types';

export function canGuestOpenAlbum(published: boolean, scope: PublicationScope): boolean {
  return published && (scope === 'EVERYONE' || scope === 'OWN_ONLY');
}

export function GuestJourney() {
  const { slug = '' } = useParams();
  const recoveryToken = new URLSearchParams(window.location.search).get('r');
  const queryClient = useQueryClient();
  const tableToken = new URLSearchParams(window.location.search).get('t') ?? undefined;
  const [recovery, setRecovery] = useState<'loading' | 'done' | 'error'>(
    recoveryToken ? 'loading' : 'done',
  );
  const recoveryStarted = useRef(false);
  const { data, isPending, isError, error } = useGuestSession(slug, tableToken, recovery === 'done');
  const { online, queued, refreshQueued } = useOnline();
  const { moment, publishedScope, eventClosed } = useMoment(slug, data?.event.id);
  const [timeClosed, setTimeClosed] = useState(false);

  useEffect(() => {
    const closesAt = data?.event.closesAt;
    if (!closesAt) return;
    let timer: number | undefined;
    const check = () => {
      const remaining = new Date(closesAt).getTime() - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        setTimeClosed(true);
        return;
      }
      setTimeClosed(false);
      timer = window.setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    check();
    return () => window.clearTimeout(timer);
  }, [data?.event.closesAt]);

  useEffect(() => {
    if (!recoveryToken || recoveryStarted.current) return;
    recoveryStarted.current = true;
    void guestApi.openRecoveryLink(slug, recoveryToken)
      .then(() => {
        const clean = new URL(window.location.href);
        clean.searchParams.delete('r');
        window.history.replaceState(null, '', `${clean.pathname}${clean.search}${clean.hash}`);
        queryClient.removeQueries({ queryKey: sessionKey(slug) });
        setRecovery('done');
      })
      .catch(() => setRecovery('error'));
  }, [queryClient, recoveryToken, slug]);

  // Les deux seules etapes qui ne se deduisent pas du serveur : l'identite,
  // que l'invite peut passer, et l'album, qu'il choisit d'ouvrir.
  const [identityDone, setIdentityDone] = useState(false);
  // Lue une fois pour toutes au montage : marquer la presentation vue ne doit
  // pas la faire disparaitre sous les doigts de l'invite en plein milieu.
  const [presentationFaite, setPresentationFaite] = useState(() => presentationVue('invite'));
  const [showAlbum, setShowAlbum] = useState(Boolean(recoveryToken));
  const [seenEnd, setSeenEnd] = useState(false);

  if (recovery === 'loading' || isPending) return <Spinner label="Ouverture de votre pellicule" />;

  if (recovery === 'error') {
    return (
      <Screen
        title="Lien personnel invalide"
        subtitle="Demandez à l’organisateur de vous renvoyer le lien de la soirée."
      >
        <p className="mt-8 text-sm text-ink-3">
          Ce lien est incomplet ou ne correspond pas à cette soirée.
        </p>
      </Screen>
    );
  }

  if (isError) {
    // Une soiree fermee ou complete n'est pas une soiree introuvable :
    // annoncer « introuvable » puis expliquer en dessous que la prise de vue
    // est terminee se contredit, et laisse l'invite croire a un mauvais lien.
    const { title, subtitle } = accessRefusal(error);
    return (
      <Screen title={title} subtitle={subtitle}>
        <p className="mt-8 text-sm text-ink-3">{error.message}</p>
      </Screen>
    );
  }

  const { roll, event } = data;

  if (!roll.hasConsented) {
    return (
      <ConsentScreen slug={slug} eventName={event.name} welcomeMessage={event.welcomeMessage} />
    );
  }

  // La presentation vient apres le consentement et avant l'identite : a ce
  // moment l'invite est entre, il n'a encore rien fait, et les trois partis
  // pris du produit — vues comptees, aucun apercu, album le lendemain —
  // arrivent juste avant qu'il les rencontre. Avant le consentement, ils
  // repousseraient l'entree ; apres la premiere photographie, trop tard.
  if (!presentationFaite && roll.shotsLeft === event.quotaShots) {
    return (
      <Onboarding
        role="invite"
        previewMode={event.previewMode}
        onDone={() => setPresentationFaite(true)}
      />
    );
  }

  if (!identityDone && roll.firstName === null && roll.shotsLeft === event.quotaShots) {
    return (
      <IdentityScreen
        slug={slug}
        useTableCodes={event.useTableCodes}
        tables={event.tables}
        initialTableId={roll.tableId}
        onDone={() => setIdentityDone(true)}
      />
    );
  }

  // L'album est ouvert soit parce que l'hote vient de publier — message
  // temps reel —, soit parce qu'il avait publie avant que l'invite revienne.
  const effectiveScope = publishedScope ?? event.scope;
  const albumReady = canGuestOpenAlbum(
    publishedScope !== null || event.albumPublished,
    effectiveScope,
  );

  // La publication ne doit pas laisser un invite bloque dans un viseur dont
  // l'evenement vient d'etre ferme. Elle ouvre l'album uniquement lorsque la
  // regle choisie par l'organisateur donne effectivement acces aux invites.
  if ((showAlbum && albumReady) || (publishedScope !== null && albumReady)) {
    return <AlbumScreen slug={event.slug} firstName={roll.firstName} />;
  }

  // La soiree est finie : l'invite ne photographie plus, il attend.
  if (event.state !== 'OPEN' || eventClosed || timeClosed || roll.shotsLeft + roll.bonusShots === 0) {
    // Un premier passage propose le code de recuperation ; les suivants
    // montrent directement l'attente, sans reposer la meme question.
    if (!seenEnd) {
      return (
        <EndOfRollScreen
          slug={event.slug}
          queued={queued}
          albumReady={albumReady}
          onSeeAlbum={() => (albumReady ? setShowAlbum(true) : setSeenEnd(true))}
        />
      );
    }

    return (
      <DevelopmentScreen
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
      quotaShots={event.quotaShots}
      joinCode={event.joinCode}
      previewMode={event.previewMode}
      photoShape={event.photoShape}
      shotsLeft={roll.shotsLeft}
      bonusShots={roll.bonusShots}
      queued={queued}
      online={online}
      moment={moment}
      onEmpty={() => void refreshQueued()}
    />
  );
}

/** Traduit le refus d'acces a une pellicule en un titre qui ne se contredit pas. */
export function accessRefusal(error: Error): { title: string; subtitle: string } {
  const code = error instanceof ApiError ? error.code : 'UNKNOWN';
  if (code === 'EVENT_CLOSED') {
    return {
      title: 'Soirée terminée',
      subtitle: "La prise de vue est close. L'album vous sera ouvert dès que l'organisateur l'aura publié.",
    };
  }
  if (code === 'EVENT_FULL') {
    return {
      title: 'Soirée complète',
      subtitle: "Cette soirée a atteint son nombre maximal de participants. Demandez à l'organisateur d'agrandir la liste.",
    };
  }
  return {
    title: 'Événement introuvable',
    subtitle: "Ce lien n'est plus valide, ou la soirée est terminée depuis plus de trente jours.",
  };
}
