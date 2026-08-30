// apps/web/src/lib/socket.ts
// Canal descendant : moments forts et publication de l'album.
//
// Le client n'emet qu'une chose, event:join. Toute action passe par HTTP,
// ou les memes controles d'autorisation s'appliquent. Le jeton d'appareil
// n'est pas transmis ici : il voyage dans le cookie de la poignee de main,
// que le serveur lit lui-meme.

import { Capacitor } from '@capacitor/core';
import { io, type Socket } from 'socket.io-client';

export interface MomentStarted {
  momentId: string;
  label: string;
  endsAt: string;
  bonusShots: number;
}

export interface ServerEvents {
  'event:joined': (payload: { eventId: string }) => void;
  'event:join:error': (payload: { reason: string }) => void;
  'moment:started': (payload: MomentStarted) => void;
  'moment:ended': (payload: { momentId: string }) => void;
  'album:published': (payload: { scope: string }) => void;
}

let socket: Socket | null = null;

/** Connexion unique, partagee par toute l'application. */
export function connect(): Socket {
  // Sans argument, socket.io vise l'origine de la page. En natif cette
  // origine est capacitor://localhost : il faut donc lui donner celle du
  // serveur, exactement comme au client d'API.
  socket ??= io(Capacitor.isNativePlatform() ? import.meta.env.VITE_API_ORIGIN : undefined, {
    // withCredentials : sans lui le cookie d'appareil ne serait pas joint
    // a la poignee de main, et le serveur refuserait l'entree dans la salle.
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function joinEventRoom(eventId: string, accessToken?: string): void {
  connect().emit('event:join', accessToken ? { eventId, accessToken } : { eventId });
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}
