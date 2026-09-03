// apps/web/src/lib/api.ts
// Client d'API type.
//
// Les types viennent de @memora/types, le meme paquet que le serveur utilise
// pour valider. Appeler une route avec une charge utile invalide echoue donc
// a la compilation, pas en production.

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type {
  ConsentInput, CreateEventInput, CreateMomentInput, JoinEventInput, LoginInput,
  RecoveryCodeInput, RegisterInput, ReservePhotoInput,
} from '@memora/types';

// Sur le web, le client et l'API partagent l'origine : nginx sert l'un et
// relaie l'autre, et une adresse relative suffit. En natif il n'y a plus
// d'origine commune — la page vient de capacitor://localhost — et une
// adresse relative viserait un serveur inexistant. On donne alors l'origine
// explicitement, sans quoi aucune requete n'aboutit.
const NATIVE_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/+$/, '');
const BASE = Capacitor.isNativePlatform() ? `${NATIVE_ORIGIN ?? ''}/api` : '/api';

if (Capacitor.isNativePlatform() && !NATIVE_ORIGIN) {
  // Mieux vaut echouer au demarrage qu'a la premiere requete : l'erreur
  // serait alors un « fetch failed » qui ne dit rien de sa cause.
  throw new Error('VITE_API_ORIGIN est obligatoire pour la construction native');
}

/** Erreur renvoyee par l'API, avec son code metier et son identifiant de trace. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly traceId?: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Jeton d'acces de l'hote, garde en memoire seulement. */
let accessToken: string | null = null;
export function setAccessToken(token: string | null) { accessToken = token; }

/**
 * Renouvellement du jeton d'acces.
 *
 * Le jeton ne vit que quinze minutes. Sans ce renouvellement, la session
 * serait plus courte que la soiree : l'hote se retrouverait deconnecte au
 * milieu de son tri, sans avoir rien fait de mal.
 *
 * La promesse est partagee. Quand dix requetes echouent en meme temps parce
 * que le jeton vient d'expirer, un seul renouvellement part et les dix
 * attendent le meme resultat, au lieu d'en declencher dix.
 */
let renewal: Promise<boolean> | null = null;

function renewAccess(): Promise<boolean> {
  renewal ??= (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) return false;

      const { accessToken: token } = (await response.json()) as { accessToken: string };
      accessToken = token;
      return true;
    } catch {
      return false;
    } finally {
      // Liberee au tour de boucle suivant : les appels deja en attente
      // partagent cette tentative, les suivants en declencheront une neuve.
      queueMicrotask(() => { renewal = null; });
    }
  })();

  return renewal;
}

/**
 * Appel HTTP.
 *
 * Le jeton d'acces vit en memoire et non dans le stockage local : une faille
 * d'injection de script pourrait lire le stockage, pas une variable de module.
 * Il est perdu au rechargement, et retrouve par la route de renouvellement,
 * dont le cookie est inaccessible au JavaScript.
 *
 * Un 401 declenche un renouvellement et un seul reessai : le drapeau retried
 * evite la boucle infinie le jour ou la session est reellement finie.
 */
// Omit et non intersection : RequestInit impose deja body: BodyInit, et une
// intersection garderait cette contrainte. On veut un objet quelconque, que
// call() serialise lui-meme.
/**
 * Adresse absolue d'une route de l'API.
 *
 * Exposee parce que tout le code ne passe pas par call() : l'abonnement aux
 * notifications, par exemple, appelle fetch directement. Une adresse
 * relative y fonctionnerait sur le web et echouerait en natif, sans bruit.
 */
export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

/** Origine publique à placer dans un lien partageable, jamais l'origine locale de Capacitor. */
export function publicAppOrigin(): string {
  return Capacitor.isNativePlatform() ? NATIVE_ORIGIN! : window.location.origin.replace(/\/+$/, '');
}

type CallInit = Omit<RequestInit, 'body'> & { body?: unknown };

async function call<T>(path: string, init: CallInit = {}, retried = false): Promise<T> {
  const { body, ...rest } = init;

  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    // credentials include : sans cela, les cookies de session et d'appareil
    // ne seraient pas envoyes.
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...rest.headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  // Jeton expire : on renouvelle une fois, puis on rejoue la requete.
  // La route de renouvellement elle-meme est exclue, sinon elle s'appellerait
  // en boucle le jour ou le cookie est mort.
  if (response.status === 401 && !retried && path !== '/auth/refresh') {
    if (await renewAccess()) return call<T>(path, init, true);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      payload.code ?? 'UNKNOWN',
      response.status,
      payload.message ?? 'Une erreur est survenue',
      payload.traceId,
      payload.fields,
    );
  }

  return payload as T;
}

/**
 * Telecharge un fichier binaire avec la meme authentification que call().
 *
 * `call()` ne convient pas : il termine sur response.json(), et un PDF n'est
 * pas du JSON. Ouvrir l'adresse dans un onglet ne convient pas davantage —
 * c'est ce que faisait le kit — parce qu'une navigation du navigateur ne porte
 * aucun en-tete Authorization. La route repondait donc UNAUTHORIZED « Jeton
 * manquant » a chaque fois, et le kit imprimable n'a jamais ete telechargeable
 * une fois l'authentification en place.
 *
 * Le renouvellement du jeton est rejoue ici aussi : sans lui, un hote dont
 * l'acces vient d'expirer verrait exactement le meme refus qu'avant.
 */
async function telecharger(
  path: string,
  retried = false,
): Promise<{ blob: Blob; nom: string }> {
  const response = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (response.status === 401 && !retried && (await renewAccess())) {
    return telecharger(path, true);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      code?: string; message?: string; traceId?: string;
    };
    throw new ApiError(
      payload.code ?? 'UNKNOWN',
      response.status,
      payload.message ?? 'Le telechargement a echoue',
      payload.traceId,
    );
  }

  // Le nom vient du serveur : lui seul sait si la selection tient dans un seul
  // PDF ou demande une archive.
  const dispo = response.headers.get('Content-Disposition') ?? '';
  const nom = /filename="([^"]+)"/.exec(dispo)?.[1] ?? 'memora-kit';
  return { blob: await response.blob(), nom };
}

/**
 * Remet un fichier telecharge a l'utilisateur.
 *
 * L'ancre est creee puis retiree, et l'adresse objet revoquee : sans cela le
 * blob reste en memoire tant que l'onglet vit, et un hote qui telecharge huit
 * variantes de son kit les y garde toutes.
 */
export async function remettreFichier({ blob, nom }: { blob: Blob; nom: string }) {
  if (Capacitor.isNativePlatform() && typeof navigator.share === 'function') {
    const file = new File([blob], nom, { type: blob.type || 'application/octet-stream' });
    if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nom });
        return;
      } catch (error) {
        // Fermer la feuille de partage n'est pas une erreur de telechargement.
        if ((error as { name?: string }).name === 'AbortError') return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Distingue une panne reseau d'un refus du serveur. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
}

// --- Parcours invite ---------------------------------------------------------

export interface GuestSession {
  roll: {
    id: string; firstName: string | null; tableId: string | null;
    shotsLeft: number; bonusShots: number; hasConsented: boolean;
  };
  event: {
    id: string; slug: string; joinCode: string;
    name: string; quotaShots: number; previewMode: 'NONE' | 'FLASH' | 'BLURRED' | 'CONFIRM';
    /** @deprecated remplace par carnet ; conserve le temps de la migration. */
    color: string;
    carnet?: string | undefined;
    welcomeMessage: string | null; closesAt: string; useTableCodes: boolean;
    /** Les tables de la soiree. Le champ tableId attend un de ces identifiants. */
    tables: { id: string; label: string }[];
    /** Etat de la soiree : le client en deduit l'ecran a montrer. */
    state: 'DRAFT' | 'OPEN' | 'CLOSED' | 'PUBLISHED' | 'PURGED';
    scope: 'NONE' | 'EVERYONE' | 'SELECTED' | 'OWN_ONLY';
    /** Vrai des que l'hote a publie : c'est ce qui ouvre l'album. */
    albumPublished: boolean;
  };
}

export const guestApi = {
  join: (slug: string, tableToken?: string) =>
    call<GuestSession>(`/e/${slug}${tableToken ? `?t=${encodeURIComponent(tableToken)}` : ''}`),
  consent: (slug: string, body: ConsentInput) =>
    call<{ consentedAt: string }>(`/e/${slug}/consent`, { method: 'POST', body }),
  identity: (slug: string, body: JoinEventInput) =>
    call<{ id: string; firstName: string | null }>(`/e/${slug}/identity`, { method: 'POST', body }),
  saveCode: (slug: string, code: string) =>
    call<{ saved: boolean }>(`/e/${slug}/recovery-code`, { method: 'POST', body: { code } }),
  recover: (slug: string, body: RecoveryCodeInput) =>
    call<{ rollId: string }>(`/e/${slug}/recover`, { method: 'POST', body }),
  recoveryLink: (slug: string) =>
    call<{ token: string }>(`/e/${slug}/recovery-link`),
  openRecoveryLink: (slug: string, token: string) =>
    call<{ rollId: string }>(`/e/${slug}/recovery-link`, {
      method: 'POST', body: { token },
    }),
};

// --- Photographies -----------------------------------------------------------

export interface Reservation {
  photoId: string; uploadUrl: string; shotsLeft: number; bonusShots: number; fromBonus: boolean;
}

export const photoApi = {
  reserve: (body: ReservePhotoInput) =>
    call<Reservation>('/photos/reserve', { method: 'POST', body }),
  confirm: (idempotencyKey: string) =>
    call<{ photoId: string; status: string }>('/photos/confirm', {
      method: 'POST', body: { idempotencyKey },
    }),
  mine: () => call<{
    scope: 'EVERYONE' | 'OWN_ONLY';
    photos: { id: string; url: string; takenAt: string }[];
  }>('/photos/mine'),
  archive: () => telecharger('/photos/archive'),
  requestRemoval: (photoId: string, reason: string) =>
    call<{ request: { id: string } }>('/photos/removal', { method: 'POST', body: { photoId, reason } }),
};

/**
 * Depot du fichier vers le stockage objet.
 *
 * Volontairement hors de call() : cette requete ne va pas a notre API, elle
 * part directement vers le stockage avec l'adresse signee. Ni cookie, ni
 * jeton, ni en-tete d'autorisation — la signature suffit.
 */
export async function uploadPhoto(uploadUrl: string, blob: Blob): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('Lecture de la photo impossible'));
      reader.onload = () => {
        const value = String(reader.result ?? '');
        resolve(value.slice(value.indexOf(',') + 1));
      };
      reader.readAsDataURL(blob);
    });

    try {
      const response = await CapacitorHttp.request({
        url: uploadUrl,
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        data: base64,
        dataType: 'file',
        // L'adresse est deja signee et encodee par le stockage. La reencoder
        // cote natif invaliderait sa signature (403) sur certains appareils.
        shouldEncodeUrlParams: false,
        connectTimeout: 30_000,
        readTimeout: 120_000,
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Echec du transfert : ${response.status}`);
      }
      return;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Echec du transfert')) throw error;
      throw new TypeError('La photo sera envoyée dès que la connexion sera disponible', { cause: error });
    }
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!response.ok) throw new Error(`Echec du transfert : ${response.status}`);
}

// --- Espace hote -------------------------------------------------------------

export interface HostUser { id: string; email: string; name: string }

export interface EventSummary {
  id: string;
  name: string;
  slug: string;
  joinCode: string;
  role: 'OWNER' | 'CO_HOST';
  type: 'MARIAGE' | 'ANNIVERSAIRE' | 'ENTREPRISE';
  state: 'DRAFT' | 'OPEN' | 'CLOSED' | 'PUBLISHED' | 'PURGED';
  eventDate: string;
  closesAt: string;
  /** @deprecated remplace par carnet ; plus aucun ecran ne le demande. */
  color: string;
  carnet: string;
  quotaShots: number;
  previewMode: 'NONE' | 'FLASH' | 'BLURRED' | 'CONFIRM';
  welcomeMessage: string | null;
  useTableCodes: boolean;
  /** Present sur le detail d'une soiree, omis dans la liste. */
  tables?: { id: string; label: string }[];
  _count?: { rolls: number; photos: number };
}

export interface EventStats {
  activeGuests: number;
  totalPhotos: number;
  quotaUsedPercent: number;
  closesInMinutes: number;
  byTable: { label: string; photos: number }[];
  topMoments: { label: string; photos: number; active: boolean }[];
}

export const authApi = {
  register: (body: RegisterInput) =>
    call<{ user: HostUser; accessToken: string }>('/auth/register', { method: 'POST', body }),
  login: (body: LoginInput) =>
    call<{ user: HostUser; accessToken: string }>('/auth/login', { method: 'POST', body }),
  refresh: () => call<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),
  logout: () => call<void>('/auth/logout', { method: 'POST' }),
  me: () => call<{ user: HostUser }>('/auth/me'),
};

export interface RollSummary {
  id: string;
  firstName: string | null;
  tableLabel: string | null;
  photos: number;
  hidden: number;
  reviewed: boolean;
  pendingRemoval: boolean;
}

export interface AlbumPhoto {
  id: string;
  url: string;
  takenAt: string;
  status: 'RESERVED' | 'UPLOADED' | 'HIDDEN' | 'REMOVED';
  published: boolean;
  width: number;
  height: number;
  rollId: string;
  firstName: string | null;
  tableLabel: string | null;
  moment: { id: string; label: string } | null;
}

export interface RollPhoto {
  id: string;
  url: string;
  takenAt: string;
  status: 'UPLOADED' | 'HIDDEN';
  width: number;
  height: number;
  momentLabel: string | null;
}

export interface RollForReview {
  roll: { id: string; firstName: string | null; tableLabel: string | null; reviewed: boolean };
  photos: RollPhoto[];
}

export const rollApi = {
  list: (eventId: string) => call<{ rolls: RollSummary[] }>(`/events/${eventId}/rolls`),
  photos: (eventId: string, rollId: string) =>
    call<RollForReview>(`/events/${eventId}/rolls/${rollId}/photos`),
  review: (eventId: string, rollId: string, hiddenPhotoIds: string[]) =>
    call<{ rollId: string; hidden: number; nextRollId: string | null }>(
      `/events/${eventId}/rolls/${rollId}/review`,
      { method: 'POST', body: { hiddenPhotoIds } },
    ),
};

export interface PublishResult {
  publishedNow: number;
  /** Vrai a la premiere publication : c'est elle qui previent les invites. */
  first: boolean;
  /** Vrai quand plus aucune pellicule n'attend d'etre triee. */
  complete: boolean;
  pending: number;
}

export interface CoHost {
  id: string;
  name: string;
  email: string;
  invitedAt: string;
}

export const teamApi = {
  list: (eventId: string) => call<{ coHosts: CoHost[] }>(`/events/${eventId}/co-hosts`),
  invite: (eventId: string, email: string) =>
    call<{ coHost: CoHost }>(`/events/${eventId}/co-hosts`, { method: 'POST', body: { email } }),
  remove: (eventId: string, userId: string) =>
    call<void>(`/events/${eventId}/co-hosts/${userId}`, { method: 'DELETE' }),
  /** Rend le jeton du photographe. L'adresse complete est construite ici. */
  photographerLink: (eventId: string) =>
    call<{ token: string; quota: number }>(`/events/${eventId}/photographer`, { method: 'POST' }),
  joinAsPhotographer: (token: string) =>
    call<{
      roll: { id: string; shotsLeft: number; isPhotographer: boolean };
      event: { name: string; slug: string; color: string; carnet?: string | undefined; closesAt: string };
    }>(`/p/${token}`),
};

export interface PaymentStatus {
  paid: boolean;
  amount?: number;
  status?: string;
}

export const paymentApi = {
  status: (eventId: string) => call<PaymentStatus>(`/events/${eventId}/payment`),
  checkout: (eventId: string) =>
    call<{ url: string }>(`/events/${eventId}/checkout`, { method: 'POST' }),
};

export interface PublicAlbum {
  event: { name: string; color: string; carnet?: string | undefined };
  photos: { id: string; url: string; takenAt: string }[];
}

export const publicAlbumApi = {
  read: (token: string, code?: string) =>
    call<PublicAlbum>(`/album/${token}${code ? `?accessCode=${encodeURIComponent(code)}` : ''}`),
};

export interface RemovalRequest {
  id: string;
  reason: string;
  state: 'PENDING' | 'ACCEPTED' | 'REFUSED';
  createdAt: string;
  handledAt: string | null;
  photo: { id: string; url: string; takenAt: string; status: string };
  firstName: string | null;
  tableLabel: string | null;
}

export const removalApi = {
  list: (eventId: string) =>
    call<{ removals: RemovalRequest[] }>(`/events/${eventId}/removals`),
  handle: (requestId: string, accept: boolean) =>
    call<{ id: string; state: string }>(`/removals/${requestId}`, {
      method: 'POST',
      body: { accept },
    }),
};

export const albumApi = {
  forHost: (eventId: string) => call<{ photos: AlbumPhoto[] }>(`/events/${eventId}/album`),
  /** Publie ce qui a ete trie. La portee n'est demandee qu'une fois. */
  publishReviewed: (eventId: string, scope?: string) =>
    call<PublishResult>(`/events/${eventId}/publish-reviewed`, {
      method: 'POST',
      body: scope ? { scope } : {},
    }),
};

export interface Moment {
  id: string;
  label: string;
  plannedAt: string | null;
  startedAt: string | null;
  durationMinutes: number;
  bonusShots: number;
  active: boolean;
  photoCount: number;
}

export const momentApi = {
  list: (eventId: string) => call<{ moments: Moment[] }>(`/events/${eventId}/moments`),
  create: (eventId: string, body: CreateMomentInput) =>
    call<{ moment: Moment }>(`/events/${eventId}/moments`, { method: 'POST', body }),
  trigger: (eventId: string, momentId: string) =>
    call<{ moment: Moment }>(`/events/${eventId}/moments/${momentId}/trigger`, { method: 'POST' }),
  close: (eventId: string, momentId: string) =>
    call<{ moment: Moment }>(`/events/${eventId}/moments/${momentId}/close`, { method: 'POST' }),
};

export interface EventTable { id: string; label: string; qrToken: string }

export const tableApi = {
  create: (eventId: string, labels: string[]) =>
    call<{ tables: EventTable[] }>(`/events/${eventId}/tables`, {
      method: 'POST',
      body: { labels },
    }),
};

export const eventApi = {
  list: () => call<{ events: EventSummary[] }>('/events'),
  detail: (id: string) => call<{ event: EventSummary }>(`/events/${id}`),
  create: (body: CreateEventInput) =>
    call<{ event: EventSummary }>('/events', { method: 'POST', body }),
  update: (id: string, body: Partial<CreateEventInput>) =>
    call<{ event: EventSummary }>(`/events/${id}`, { method: 'PATCH', body }),
  open: (id: string) => call<{ event: EventSummary }>(`/events/${id}/open`, { method: 'POST' }),
  close: (id: string) => call<{ event: EventSummary }>(`/events/${id}/close`, { method: 'POST' }),
  stats: (id: string) => call<EventStats>(`/events/${id}/stats`),
  /**
   * Telecharge le kit QR. Une seule piece renvoie un PDF, plusieurs une archive.
   *
   * Passe par telecharger() et non par une adresse ouverte dans un onglet : la
   * route est derriere requireAuth, qui n'accepte qu'un en-tete Bearer.
   */
  qrKit: (id: string, pieces: readonly string[]) =>
    telecharger(`/events/${id}/qr-kit?pieces=${pieces.join(',')}`),

  /**
   * Telecharge l'album en archive.
   *
   * Le chemin est `/archive`, jamais `/download` : `/download` est le prefixe
   * de montage du routeur, pas une route. L'ecran des reglages l'appelait tel
   * quel et recevait un 404 — et l'aurait recu meme avec le bon chemin,
   * l'adresse etant ouverte dans un onglet, sans en-tete d'authentification.
   */
  archive: (id: string) => telecharger(`/events/${id}/archive`),
};
