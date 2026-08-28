// 📇 packages/types/src/enums.ts
// Les valeurs metier partagees entre le serveur et le client.
// Elles sont declarees ici une seule fois : Prisma les reprend dans son schema,
// et le front les importe pour ne jamais ecrire une chaine "en dur".

/** Type d'evenement, choisi par l'hote a la creation. */
export const EVENT_TYPES = ['MARIAGE', 'ANNIVERSAIRE', 'ENTREPRISE'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Cycle de vie d'un evenement. L'ordre du tableau est l'ordre chronologique :
 * un evenement ne revient jamais en arriere.
 */
export const EVENT_STATES = ['DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED', 'PURGED'] as const;
export type EventState = (typeof EVENT_STATES)[number];

/**
 * Ce que l'invite voit apres avoir declenche. C'est l'hote qui choisit,
 * a la configuration, et le reglage n'est plus modifiable une fois l'evenement ouvert.
 */
export const PREVIEW_MODES = ['NONE', 'FLASH', 'BLURRED', 'CONFIRM'] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];

/** Portee de publication choisie par l'hote apres son tri. */
export const PUBLICATION_SCOPES = ['NONE', 'EVERYONE', 'SELECTED', 'OWN_ONLY'] as const;
export type PublicationScope = (typeof PUBLICATION_SCOPES)[number];

/** Etats successifs d'une photographie, de la reservation a la suppression. */
export const PHOTO_STATUSES = ['RESERVED', 'UPLOADED', 'HIDDEN', 'REMOVED'] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

/** Roles reconnus par le systeme. Sert au controle des autorisations cote serveur. */
export const ROLES = ['HOST', 'CO_HOST', 'PHOTOGRAPHER', 'GUEST', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Bornes metier, utilisees a la fois par la validation et par les tests. */
export const QUOTA_MIN = 5;
export const QUOTA_MAX = 60;
export const QUOTA_DEFAULT = 24;
export const MAX_GUESTS_PER_EVENT = 200;
export const RETENTION_DAYS = 30;
export const MOMENT_BONUS_SHOTS = 3;
export const MOMENT_DEFAULT_MINUTES = 10;
