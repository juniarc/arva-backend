import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller.js';
import { createCheckoutWriteLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createCheckoutRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.post('/', createCheckoutWriteLimiter(), checkoutController.createDraft);
  router.get('/', checkoutController.getDraft);
  router.put('/address', createCheckoutWriteLimiter(), checkoutController.setAddress);

  return router;
}
