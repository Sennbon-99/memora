// 🧠 apps/api/src/services/authService.ts
// Regles metier de l'authentification de l'hote.
// Le service ne connait ni Express, ni req, ni res : il recoit des donnees
// validees et renvoie des donnees. C'est ce qui le rend testable seul.

import type { LoginInput, RegisterInput } from '@memora/types';
import { prisma } from '../config/prisma.js';
import { hashPassword, verifyPassword } from '../utils/hash.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { AppError, UnauthorizedError } from '../utils/errors.js';

export interface AuthResult {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

/** Cree un compte hote et ouvre immediatement une session. */
export async function register({ email, password, name }: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  // Message volontairement neutre : il ne doit pas permettre de savoir
  // si une adresse est deja inscrite, ce qui reviendrait a enumerer les comptes.
  if (existing) throw new AppError('REGISTRATION_FAILED', 409, "Inscription impossible avec ces informations");

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
    select: { id: true, email: true, name: true, role: true },
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken: signAccessToken({ userId: user.id, role: user.role }),
    refreshToken: signRefreshToken(user.id),
  };
}

/** Verifie les identifiants et delivre les deux jetons. */
export async function login({ email, password }: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Meme reponse que l'adresse soit inconnue ou le mot de passe faux.
  // On appelle quand meme verifyPassword sur une empreinte factice quand le
  // compte n'existe pas, pour que le temps de reponse ne trahisse rien.
  const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const valid = await verifyPassword(password, hash);

  if (!user || !valid) throw new UnauthorizedError('Identifiants incorrects');

  return {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken: signAccessToken({ userId: user.id, role: user.role }),
    refreshToken: signRefreshToken(user.id),
  };
}

/** Delivre un nouveau jeton d'acces a partir du jeton de renouvellement. */
export async function refresh(userId: string): Promise<{ accessToken: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) throw new UnauthorizedError('Utilisateur introuvable');

  return { accessToken: signAccessToken({ userId: user.id, role: user.role }) };
}
