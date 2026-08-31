// packages/types/src/enums.ts
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

/**
 * Palier gratuit. La premiere soiree d'un compte est offerte, mais bornee.
 *
 * Ces valeurs vivent ici et non dans l'API : le serveur les applique, le
 * client les annonce a l'hote avant qu'il ne choisisse. Deux copies auraient
 * fini par diverger, et l'hote aurait lu une promesse que le serveur ne
 * tenait pas.
 */
export const FREE_TIER = { events: 1, guests: 20, shots: 10 } as const;

/**
 * Les carnets.
 *
 * Un carnet est un jeu de valeurs — couleurs, formes, matiere, etalonnage des
 * photographies — applique au parcours de l'invite. Il ne change aucune
 * structure : les douze ecrans sont rigoureusement les memes dans les trois.
 * C'est ce qui permet d'en ajouter un en une demi-journee.
 */
export const CARNETS = ['papier', 'carnet-noir', 'bleu'] as const;
export type Carnet = (typeof CARNETS)[number];

/**
 * Le carnet de la marque. Il habille la page d'accueil publique, l'espace de
 * l'hote, et le parcours d'un invite dont on ignore encore la soiree.
 * Memora est le carnet vierge ; c'est la soiree qui le remplit et le colore.
 */
export const CARNET_MARQUE: Carnet = 'papier';

/**
 * Le carnet propose selon le type de soiree.
 *
 * L'hote peut en changer, mais il n'a jamais a choisir pour que sa soiree
 * soit habillee : l'ecran de choix confirme un defaut, il ne le reclame pas.
 */
export const CARNET_PAR_TYPE: Record<EventType, Carnet> = {
  MARIAGE: 'carnet-noir',
  ANNIVERSAIRE: 'papier',
  ENTREPRISE: 'bleu',
};
