// apps/web/src/features/guest/useMoment.ts
// Moment fort en cours : le bandeau du viseur, et les poses offertes.
//
// Deux sources pour la meme information. Le message temps reel arrive a
// l'instant ou l'hote declenche ; la reponse de la session porte le moment
// deja en cours pour l'invite qui ouvre l'application en retard. Sans la
// seconde, un invite arrive trente secondes trop tard ne verrait rien.

import { useEffect, useState } from 'react';
import { connect, joinEventRoom, type MomentStarted } from '../../lib/socket.js';
import { useUpdateSession } from './useGuestSession.js';
import type { PublicationScope } from '@memora/types';

export interface ActiveMoment {
  label: string;
  endsAt: string;
}

export function useMoment(slug: string, eventId: string | undefined) {
  const [moment, setMoment] = useState<ActiveMoment | null>(null);
  const [publishedScope, setPublishedScope] = useState<PublicationScope | null>(null);
  const [eventClosed, setEventClosed] = useState(false);
  const update = useUpdateSession(slug);

  useEffect(() => {
    if (!eventId) return;

    const socket = connect();
    joinEventRoom(eventId);

    const onStarted = (payload: MomentStarted) => {
      setMoment({ label: payload.label, endsAt: payload.endsAt });
      // Les poses offertes sont creditees cote serveur ; on les reflete tout
      // de suite pour que le compteur ne mente pas pendant la fenetre.
      update((previous) => ({
        ...previous,
        roll: { ...previous.roll, bonusShots: previous.roll.bonusShots + payload.bonusShots },
      }));
    };

    const onEnded = () => setMoment(null);
    const onClosed = () => setEventClosed(true);
    const onPublished = ({ scope }: { scope: PublicationScope }) => setPublishedScope(scope);

    socket.on('moment:started', onStarted);
    socket.on('moment:ended', onEnded);
    socket.on('event:closed', onClosed);
    socket.on('album:published', onPublished);

    return () => {
      socket.off('moment:started', onStarted);
      socket.off('moment:ended', onEnded);
      socket.off('event:closed', onClosed);
      socket.off('album:published', onPublished);
    };
  }, [eventId, update]);

  // Une fenetre expiree n'est jamais annoncee close par le serveur si
  // l'invite avait ferme l'application : on verifie l'heure a chaque rendu.
  const expired = moment !== null && new Date(moment.endsAt).getTime() < Date.now();

  return { moment: expired ? null : moment, publishedScope, eventClosed };
}
