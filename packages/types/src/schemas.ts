// packages/types/src/schemas.ts
// Les contrats d'entree de l'API, ecrits une seule fois avec Zod.
// Le serveur les utilise pour valider ce qu'il recoit, le client pour valider
// avant d'envoyer. Une regle qui change ici change des deux cotes a la fois :
// c'est ce qui rend la desynchronisation impossible.

import { z } from 'zod';
import './locale.js';   // messages de validation en francais, avant tout schema
import {
  EVENT_TYPES,
  PREVIEW_MODES,
  PUBLICATION_SCOPES,
  QUOTA_MAX,
  QUOTA_MIN,
} from './enums.js';

// --- Briques reutilisables ---------------------------------------------------

/** Couleur hexadecimale a six chiffres, celle que l'hote choisit pour son evenement. */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur attendue au format #RRGGBB');

/** Identifiant CUID genere par Prisma. */
export const cuidSchema = z.string().cuid();

// --- Authentification de l'hote ----------------------------------------------

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse electronique invalide'),
  // 12 caracteres minimum : la regle est ici, pas dans le formulaire.
  password: z.string().min(12, 'Le mot de passe doit faire au moins 12 caracteres'),
  name: z.string().trim().min(2, 'Deux caracteres au moins').max(60, 'Soixante caracteres au plus'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse electronique invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// --- Evenement ---------------------------------------------------------------

export const createEventSchema = z.object({
  name: z.string().trim().min(3, 'Trois caracteres au moins').max(80, 'Quatre-vingts caracteres au plus'),
  type: z.enum(EVENT_TYPES),
  eventDate: z.coerce.date(),
  quotaShots: z.number().int().min(QUOTA_MIN).max(QUOTA_MAX),
  // L'heure de fermeture doit etre dans le futur : une soiree ne se ferme pas hier.
  closesAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "L'heure de fermeture doit etre posterieure a maintenant",
  }),
  previewMode: z.enum(PREVIEW_MODES),
  color: hexColorSchema,
  welcomeMessage: z.string().trim().max(280).optional(),
  useTableCodes: z.boolean().default(false),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

/** Mise a jour partielle : tous les champs deviennent facultatifs. */
export const updateEventSchema = createEventSchema.partial();
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const publishEventSchema = z.object({
  scope: z.enum(PUBLICATION_SCOPES),
  photoIds: z.array(cuidSchema).max(5000),
  // Code d'acces facultatif, pour un seminaire ou un evenement sensible.
  accessCode: z.string().regex(/^\d{6}$/).optional(),
});
export type PublishEventInput = z.infer<typeof publishEventSchema>;

// --- Session invite ----------------------------------------------------------

export const joinEventSchema = z.object({
  // Le prenom est facultatif : l'invite peut rester anonyme.
  firstName: z.string().trim().min(2, 'Deux caracteres au moins').max(30, 'Trente caracteres au plus').optional(),
  tableId: cuidSchema.optional(),
});
export type JoinEventInput = z.infer<typeof joinEventSchema>;

export const consentSchema = z.object({
  // Le refus ne passe pas par cette route : sans acceptation, pas de requete.
  accepted: z.literal(true),
});
export type ConsentInput = z.infer<typeof consentSchema>;

export const recoveryCodeSchema = z.object({
  firstName: z.string().trim().min(2, 'Deux caracteres au moins').max(30, 'Trente caracteres au plus'),
  code: z.string().regex(/^\d{4}$/, 'Le code comporte quatre chiffres'),
});
export type RecoveryCodeInput = z.infer<typeof recoveryCodeSchema>;

// --- Photographies -----------------------------------------------------------

export const reservePhotoSchema = z.object({
  // Cle generee par le client. C'est elle qui rend l'operation idempotente :
  // deux envois portant la meme cle ne consomment qu'une seule pose.
  idempotencyKey: z.string().uuid(),
  takenAt: z.coerce.date(),
  width: z.number().int().positive().max(12000),
  height: z.number().int().positive().max(12000),
  sizeBytes: z.number().int().positive().max(20_000_000),
});
export type ReservePhotoInput = z.infer<typeof reservePhotoSchema>;

export const confirmPhotoSchema = z.object({
  idempotencyKey: z.string().uuid(),
});
export type ConfirmPhotoInput = z.infer<typeof confirmPhotoSchema>;

export const removalRequestSchema = z.object({
  photoId: cuidSchema,
  reason: z.string().trim().min(3, 'Expliquez en quelques mots').max(280, 'Deux cent quatre-vingts caracteres au plus'),
});
export type RemovalRequestInput = z.infer<typeof removalRequestSchema>;

// --- Moments forts -----------------------------------------------------------

export const createMomentSchema = z.object({
  label: z.string().trim().min(3).max(60),
  plannedAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().min(1).max(60),
  bonusShots: z.number().int().min(0).max(10),
});
export type CreateMomentInput = z.infer<typeof createMomentSchema>;
