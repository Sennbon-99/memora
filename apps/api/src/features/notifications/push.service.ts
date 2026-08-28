// apps/api/src/features/notifications/push.service.ts
// Notifications web push.
//
// Elles servent a deux moments precis : le declenchement d'un moment fort,
// et la publication de l'album. Rien d'autre — une application qui notifie
// pour tout finit par etre coupee, et ces deux notifications-la portent
// justement ce qui fait revenir l'invite.
//
// Limite connue et documentee : sur iOS, une application web ne recoit de
// notifications que si elle a ete ajoutee a l'ecran d'accueil. C'est pour
// cela que le repli existe — un bandeau affiche a la reouverture, tant que
// la fenetre du moment n'est pas expiree.

import webpush from 'web-push';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';

let configured = false;

/**
 * Configure les cles VAPID a la premiere utilisation.
 *
 * Ce n'est pas fait au demarrage : le push est facultatif, et l'API doit
 * pouvoir tourner sans que les cles soient renseignees.
 */
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;

  webpush.setVapidDetails(
    `mailto:${env.VAPID_SUBJECT}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Diffuse une notification a tous les invites abonnes d'un evenement.
 *
 * Les envois partent en parallele et les echecs sont absorbes : un
 * abonnement expire ne doit pas empecher les deux cents autres de recevoir
 * la notification. Les abonnements devenus invalides sont supprimes au
 * passage, sinon la table grossirait indefiniment.
 */
export async function notifyEvent(eventId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { roll: { eventId } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const body = JSON.stringify(payload);
  const expired: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err) {
        // 404 ou 410 : l'abonnement n'existe plus cote navigateur.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.id);
        throw err;
      }
    }),
  );

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
  }

  return results.filter((r) => r.status === 'fulfilled').length;
}

/** Enregistre l'abonnement d'un appareil. */
export async function subscribe(
  rollId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      rollId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: { rollId },
    select: { id: true },
  });
}
