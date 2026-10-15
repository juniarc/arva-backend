import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { createProfileWriteLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createProfileRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.get('/', profileController.getProfile);
  router.put('/', createProfileWriteLimiter(), profileController.updateProfile);
  router.put('/address', createProfileWriteLimiter(), profileController.upsertAddress);

  return router;
}
