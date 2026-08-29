// apps/web/src/lib/push.ts
// Abonnement aux notifications.
//
// Le point le plus delicat du parcours invite : le navigateur ne donne
// qu'une seule chance. Un refus est definitif, il n'existe aucune facon de
// redemander. Toute la logique ci-dessous existe pour ne pas gaspiller
// cette chance : on verifie d'abord que l'envoi est possible, et on ne
// declenche la demande native qu'apres un geste explicite de l'invite.

export type PushState =
  | 'unsupported'   // le navigateur ne sait pas faire
  | 'needs-install' // iOS : rien n'arrive tant que l'application n'est pas installee
  | 'blocked'       // refus deja donne, definitif
  | 'granted'       // deja accorde
  | 'askable';      // on peut proposer

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Vrai si la page tourne depuis l'ecran d'accueil et non dans le navigateur. */
export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Ou en est-on, avant toute demande.
 *
 * L'ordre des tests compte : sur iPhone non installe, l'API existe mais
 * l'abonnement echoue silencieusement. Proposer la notification dans cet
 * etat, c'est promettre quelque chose qui n'arrivera jamais.
 */
export function pushState(): PushState {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (isIOS() && !isInstalled()) return 'needs-install';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission === 'granted') return 'granted';
  return 'askable';
}

/**
 * Convertit la cle VAPID base64url en octets, format attendu par le navigateur.
 *
 * Le tampon est declare ArrayBuffer et non ArrayBufferLike : depuis
 * TypeScript 5.7, Uint8Array est generique sur son tampon, et pushManager
 * refuse un SharedArrayBuffer.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);

  const octets = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) octets[index] = raw.charCodeAt(index);
  return octets;
}

interface SubscribeResult {
  ok: boolean;
  reason?: PushState | 'refused' | 'failed';
}

/**
 * Demande la permission puis enregistre l'abonnement.
 * A n'appeler que sur un geste de l'invite, jamais au chargement.
 */
export async function subscribeToPush(vapidKey: string): Promise<SubscribeResult> {
  const state = pushState();
  if (state !== 'askable' && state !== 'granted') return { ok: false, reason: state };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'refused' };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      // Sans userVisibleOnly, Chrome refuse l'abonnement : le navigateur
      // exige que chaque envoi produise une notification visible.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string; keys: { p256dh: string; auth: string };
    };

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, keys }),
    });

    return response.ok ? { ok: true } : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** La cle publique du serveur, ou rien si les notifications sont desactivees. */
export async function fetchVapidKey(): Promise<string | null> {
  try {
    const response = await fetch('/api/push/key', { credentials: 'include' });
    if (!response.ok) return null;
    const { key } = (await response.json()) as { key: string | null };
    return key;
  } catch {
    return null;
  }
}
