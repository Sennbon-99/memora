// apps/api/src/realtime/socket.ts
// Diffusion temps reel : moments forts, tableau de bord, publication.
//
// Le probleme resolu ici : les controleurs emettent vers la salle
// "event:<id>", mais tant que personne ne la rejoint, ces messages partent
// dans le vide. C'est ce fichier qui fait entrer les clients dans la bonne
// salle, et surtout qui verifie qu'ils ont le droit d'y etre.

import type { Server, Socket } from 'socket.io';
import { prisma } from '../config/prisma.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { verifyDeviceToken } from '../utils/jwt.js';
import { DEVICE_COOKIE } from '../middlewares/requireGuest.js';

/** Nom de la salle d'un evenement. Un seul endroit le decide. */
export const eventRoom = (eventId: string) => `event:${eventId}`;

/**
 * Extrait le jeton d'appareil de l'en-tete Cookie de la poignee de main.
 *
 * Le client ne peut pas le fournir lui-meme : le cookie est httpOnly, donc
 * invisible au JavaScript de la page. C'est voulu — une faille d'injection
 * ne doit pas pouvoir voler une pellicule. On le lit donc ici, cote serveur,
 * dans l'en-tete que le navigateur joint automatiquement a la connexion.
 */
export function deviceTokenFromCookies(header: string | undefined): string | undefined {
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === DEVICE_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

/**
 * Verifie qu'un client a le droit de suivre un evenement.
 *
 * Deux voies. Un hote presente son jeton d'acces : on verifie qu'il possede
 * l'evenement ou qu'il en est co-hote. Un invite presente son cookie
 * d'appareil : on verifie que sa pellicule appartient bien a cet evenement.
 *
 * Sans ce controle, n'importe qui connaissant un identifiant d'evenement
 * recevrait les notifications de moments et le tableau de bord en direct.
 */
async function canJoin(
  eventId: string,
  credentials: { accessToken?: string | undefined; deviceToken?: string | undefined },
): Promise<boolean> {
  if (credentials.accessToken) {
    try {
      const { userId } = verifyAccessToken(credentials.accessToken);
      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
          OR: [{ ownerId: userId }, { coHosts: { some: { userId } } }],
        },
        select: { id: true },
      });
      if (event) return true;
    } catch {
      // Jeton invalide : on continue, l'invite a peut-etre un cookie valide.
    }
  }

  if (credentials.deviceToken) {
    const decoded = verifyDeviceToken(credentials.deviceToken);
    if (!decoded) return false;
    const roll = await prisma.roll.findFirst({
      where: { id: decoded.rollId, eventId },
      select: { id: true },
    });
    return roll !== null;
  }

  return false;
}

/**
 * Branche la passerelle temps reel.
 *
 * Les clients n'emettent jamais rien qui modifie l'etat : Socket.io ne sert
 * ici qu'a la diffusion descendante. Toute action passe par l'API HTTP, ou
 * les memes controles d'autorisation s'appliquent.
 */
export function setupRealtime(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('event:join', async (payload: unknown) => {
      const { eventId, accessToken, deviceToken } = (payload ?? {}) as {
        eventId?: string; accessToken?: string; deviceToken?: string;
      };
      if (typeof eventId !== 'string') {
        socket.emit('event:join:error', { reason: 'MISSING_EVENT' });
        return;
      }

      // Le cookie de la poignee de main fait foi pour l'invite ; la charge
      // utile ne sert qu'a l'hote, dont le jeton vit en memoire.
      const allowed = await canJoin(eventId, {
        accessToken,
        deviceToken: deviceTokenFromCookies(socket.handshake.headers.cookie) ?? deviceToken,
      });
      if (!allowed) {
        socket.emit('event:join:error', { reason: 'FORBIDDEN' });
        return;
      }

      await socket.join(eventRoom(eventId));
      socket.emit('event:joined', { eventId });
    });

    socket.on('event:leave', async (payload: unknown) => {
      const { eventId } = (payload ?? {}) as { eventId?: string };
      if (typeof eventId === 'string') await socket.leave(eventRoom(eventId));
    });
  });
}
