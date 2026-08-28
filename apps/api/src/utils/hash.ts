// 🔒 apps/api/src/utils/hash.ts
// Hachage des mots de passe et des codes de recuperation.

import bcrypt from 'bcrypt';

// 12 tours : compromis courant entre resistance au calcul et temps de reponse.
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Le code a quatre chiffres est hache, jamais stocke en clair. */
export function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(code, SALT_ROUNDS);
}

export function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
