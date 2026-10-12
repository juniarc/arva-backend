import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { createAuthLimiter, createLoginLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createAuthRouter(): Router {
  const router = Router();

  router.use(createAuthLimiter());
  router.post('/register', authController.register);
  router.post('/login', createLoginLimiter(), authController.login);
  router.get('/me', requireAuth, authController.me);

  return router;
}
