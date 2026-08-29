// apps/api/src/realtime/broadcast.ts
// Diffusion vers la salle d'un evenement.
//
// Deux problemes reels sont resolus ici, decouverts en lancant l'API contre
// la vraie infrastructure plutot qu'en la simulant.
//
// Le premier : Socket.io est cree apres l'application Express, parce qu'il
// a besoin du serveur HTTP, qui a lui-meme besoin de l'application. Le
// controleur ne peut donc pas capturer l'instance a la construction, il doit
// la lire au moment de la requete.
//
// Le second, plus grave : un echec de diffusion ne doit jamais transformer
// une ecriture reussie en erreur. Quand une photographie vient d'etre
// confirmee, elle est en base et dans le stockage ; renvoyer un 500 parce
// que la notification temps reel a echoue ferait croire au client que sa
// pose est perdue, et il la reprendrait.

import type { Request } from 'express';
import type { Server } from 'socket.io';
import { eventRoom } from './socket.js';

/** L'instance de Socket.io, ou rien si le serveur temps reel n'a pas demarre. */
export function realtime(req: Request): Server | undefined {
  return req.app.get('io') as Server | undefined;
}

/**
 * Emet vers la salle d'un evenement, sans jamais faire echouer la requete.
 * Le retour dit si la diffusion a eu lieu, pour les tests.
 */
export function emitToEvent(
  req: Request,
  eventId: string,
  name: string,
  payload: unknown,
): boolean {
  const io = realtime(req);
  if (!io) return false;

  try {
    io.to(eventRoom(eventId)).emit(name, payload);
    return true;
  } catch (err) {
    // On trace et on continue : l'ecriture, elle, a bien eu lieu.
    console.error(`Diffusion ${name} vers ${eventId} echouee`, err);
    return false;
  }
}
