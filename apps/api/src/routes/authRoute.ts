// 🚏 apps/api/src/routes/authRoute.ts
import { Router } from 'express';
import { loginSchema, registerSchema } from '@memora/types';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import * as authController from '../controllers/authController.js';

export const authRouter = Router();

// 🧠 POST /api/auth/register — creer un compte hote
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);

// 🧠 POST /api/auth/login — ouvrir une session
authRouter.post('/login', authLimiter, validate(loginSchema), authController.login);

// 🧠 POST /api/auth/refresh — renouveler le jeton d'acces depuis le cookie
authRouter.post('/refresh', authController.refresh);

// 🧠 POST /api/auth/logout — effacer le cookie de renouvellement
authRouter.post('/logout', authController.logout);

// 🧠 GET /api/auth/me — profil de l'utilisateur connecte
authRouter.get('/me', requireAuth, authController.me);
