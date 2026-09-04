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

/**
 * Le cadrage de la prise de vue, choisi par l'organisateur a la creation.
 *
 * SQUARE recadre au carre, comme un tirage d'appareil jetable. FULL garde le
 * champ que le capteur donne : rien n'est jete, et le viseur montre alors
 * exactement ce qui sera enregistre.
 */
export const PHOTO_SHAPES = ['SQUARE', 'FULL'] as const;
export type PhotoShape = (typeof PHOTO_SHAPES)[number];

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
 * Les pieces du kit imprimable.
 *
 * Elles vivent ici parce que les deux cotes en ont besoin : le serveur pour
 * les dessiner, le client pour les proposer a cocher avec leur format et leur
 * nombre de pages. Deux listes auraient fini par diverger, et l'hote aurait
 * telecharge autre chose que ce qu'il avait coche.
 *
 * L'ordre est celui du kit : de la plus grande piece a la plus petite.
 */
export const KIT_PIECES = [
  'affiche-a2', 'affiche-a3', 'affiche-a4',
  'cartes', 'chevalet', 'autocollants', 'carton',
] as const;
export type KitPiece = (typeof KIT_PIECES)[number];

/**
 * Ce que chaque piece annonce avant d'etre telechargee.
 *
 * `qrMm` est le cote du code une fois imprime. La regle qui le gouverne : la
 * distance de lecture fiable vaut environ dix fois ce cote. Volontairement
 * prudente — les telephones recents font mieux — mais c'est celle qui tient
 * quand l'affiche est derriere une vitre ou en contre-jour.
 */
export const KIT_PIECE_INFO: Record<KitPiece, {
  label: string;
  format: string;
  qrMm: number;
  note: string;
}> = {
  'affiche-a2': { label: "Affiche d'entrée", format: 'A2', qrMm: 180, note: 'Très grande salle · imprimeur' },
  'affiche-a3': { label: "Affiche d'entrée", format: 'A3', qrMm: 120, note: 'Le format de référence' },
  'affiche-a4': { label: 'Affiche de secours', format: 'A4', qrMm: 90, note: 'Imprimable chez vous' },
  cartes: { label: 'Cartes de table', format: 'A5 plié', qrMm: 50, note: 'Une par table' },
  chevalet: { label: 'Chevalet de bar', format: 'A5', qrMm: 70, note: 'Buffet, cocktail debout' },
  // 30 mm et non 35 : au-dela, les coins du code sortent du cercle de
  // decoupe, et un autocollant decoupe perd ses reperes. Voir la geometrie
  // de la planche et le test qui la surveille, dans qrkit.
  autocollants: { label: 'Autocollants', format: 'Planche de 20', qrMm: 30, note: 'Toilettes, bar, photobooth' },
  carton: { label: 'Carton pour le faire-part', format: 'A6', qrMm: 40, note: 'Glissé dans l’invitation' },
};

/**
 * Les trois pieces cochees d'avance.
 *
 * L'affiche A4 est le filet de securite, et elle se defend meme si elle
 * parait redondante : l'A3 demande un point d'impression, l'A4 sort de
 * n'importe quelle imprimante, a minuit la veille. C'est la piece sans
 * laquelle personne n'entre dans la soiree.
 */
export const KIT_PIECES_PAR_DEFAUT: KitPiece[] = ['affiche-a3', 'affiche-a4', 'cartes'];

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
