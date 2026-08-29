// apps/web/src/lib/api.ts
// Client d'API type.
//
// Les types viennent de @memora/types, le meme paquet que le serveur utilise
// pour valider. Appeler une route avec une charge utile invalide echoue donc
// a la compilation, pas en production.

import type {
  ConsentInput, CreateEventInput, JoinEventInput, LoginInput,
  RecoveryCodeInput, RegisterInput, ReservePhotoInput,
} from '@memora/types';

const BASE = '/api';

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

/** Distingue une panne reseau d'un refus du serveur. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
}

// --- Parcours invite ---------------------------------------------------------

export interface GuestSession {
  roll: { id: string; firstName: string | null; shotsLeft: number; bonusShots: number; hasConsented: boolean };
  event: {
    name: string; quotaShots: number; previewMode: 'NONE' | 'FLASH' | 'BLURRED' | 'CONFIRM';
    color: string; welcomeMessage: string | null; closesAt: string; useTableCodes: boolean;
  };
}

export const guestApi = {
  join: (slug: string) => call<GuestSession>(`/e/${slug}`),
  consent: (slug: string, body: ConsentInput) =>
    call<{ consentedAt: string }>(`/e/${slug}/consent`, { method: 'POST', body }),
  identity: (slug: string, body: JoinEventInput) =>
    call<{ id: string; firstName: string | null }>(`/e/${slug}/identity`, { method: 'POST', body }),
  saveCode: (slug: string, code: string) =>
    call<{ saved: boolean }>(`/e/${slug}/recovery-code`, { method: 'POST', body: { code } }),
  recover: (slug: string, body: RecoveryCodeInput) =>
    call<{ rollId: string }>(`/e/${slug}/recover`, { method: 'POST', body }),
};

// --- Photographies -----------------------------------------------------------

export interface Reservation {
  photoId: string; uploadUrl: string; shotsLeft: number; fromBonus: boolean;
}

export const photoApi = {
  reserve: (body: ReservePhotoInput) =>
    call<Reservation>('/photos/reserve', { method: 'POST', body }),
  confirm: (idempotencyKey: string) =>
    call<{ photoId: string; status: string }>('/photos/confirm', {
      method: 'POST', body: { idempotencyKey },
    }),
  mine: () => call<{ photos: { id: string; url: string; takenAt: string }[] }>('/photos/mine'),
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
  type: 'MARIAGE' | 'ANNIVERSAIRE' | 'ENTREPRISE';
  state: 'DRAFT' | 'OPEN' | 'CLOSED' | 'PUBLISHED' | 'PURGED';
  eventDate: string;
  closesAt: string;
  color: string;
  quotaShots: number;
  previewMode: 'NONE' | 'FLASH' | 'BLURRED' | 'CONFIRM';
  welcomeMessage: string | null;
  useTableCodes: boolean;
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

export const rollApi = {
  list: (eventId: string) => call<{ rolls: RollSummary[] }>(`/events/${eventId}/rolls`),
  review: (eventId: string, rollId: string, hiddenPhotoIds: string[]) =>
    call<{ rollId: string; hidden: number }>(`/events/${eventId}/rolls/${rollId}/review`, {
      method: 'POST',
      body: { hiddenPhotoIds },
    }),
};

export const albumApi = {
  forHost: (eventId: string) => call<AlbumPhoto[]>(`/events/${eventId}/album`),
  publish: (eventId: string, scope: string, photoIds: string[]) =>
    call<{ scope: string }>(`/events/${eventId}/publish`, {
      method: 'POST',
      body: { scope, photoIds },
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
  /** Adresse du kit QR. Ouverte dans un onglet, pas passee par call(). */
  qrKitUrl: (id: string) => `${BASE}/events/${id}/qr-kit`,
};
