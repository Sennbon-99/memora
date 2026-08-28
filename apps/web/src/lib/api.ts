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
 * Appel HTTP.
 *
 * Le jeton d'acces vit en memoire et non dans le stockage local : une faille
 * d'injection de script pourrait lire le stockage, pas une variable de module.
 * Il est perdu au rechargement, et retrouve par la route de renouvellement,
 * dont le cookie est inaccessible au JavaScript.
 */
// Omit et non intersection : RequestInit impose deja body: BodyInit, et une
// intersection garderait cette contrainte. On veut un objet quelconque, que
// call() serialise lui-meme.
type CallInit = Omit<RequestInit, 'body'> & { body?: unknown };

async function call<T>(path: string, init: CallInit = {}): Promise<T> {
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

export const authApi = {
  register: (body: RegisterInput) =>
    call<{ user: { id: string; email: string; name: string }; accessToken: string }>(
      '/auth/register', { method: 'POST', body },
    ),
  login: (body: LoginInput) =>
    call<{ user: { id: string; email: string; name: string }; accessToken: string }>(
      '/auth/login', { method: 'POST', body },
    ),
  refresh: () => call<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),
  logout: () => call<void>('/auth/logout', { method: 'POST' }),
  me: () => call<{ user: { id: string; email: string; name: string } }>('/auth/me'),
};

export const eventApi = {
  list: () => call<{ events: unknown[] }>('/events'),
  create: (body: CreateEventInput) => call<{ event: { id: string } }>('/events', { method: 'POST', body }),
  open: (id: string) => call<{ event: unknown }>(`/events/${id}/open`, { method: 'POST' }),
  close: (id: string) => call<{ event: unknown }>(`/events/${id}/close`, { method: 'POST' }),
  stats: (id: string) => call<Record<string, unknown>>(`/events/${id}/stats`),
};
