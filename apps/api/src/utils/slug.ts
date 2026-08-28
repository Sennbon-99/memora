// 🔤 apps/api/src/utils/slug.ts
// Fabrication des identifiants publics et des jetons.

import { randomBytes } from 'node:crypto';

/** Retire les signes diacritiques et tout ce qui n'est pas alphanumerique. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Slug d'un evenement : partie lisible suivie d'un suffixe aleatoire.
 * Le suffixe n'est pas decoratif. Sans lui, l'adresse d'un mariage serait
 * devinable a partir des prenoms des maries, et n'importe qui pourrait
 * rejoindre l'evenement sans avoir jamais vu le QR code.
 * Exemple : "mariage-de-lea-et-sam-7f3a9c"
 */
export function buildEventSlug(name: string): string {
  return `${normalize(name) || 'evenement'}-${randomBytes(3).toString('hex')}`;
}

/** Jeton opaque, pour un QR code de table ou un lien d'album. */
export function buildToken(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

/** Code a quatre chiffres propose a l'invite en fin de pellicule. */
export function buildRecoveryCode(): string {
  return String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
}
