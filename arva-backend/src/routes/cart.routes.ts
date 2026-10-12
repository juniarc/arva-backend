import { Router } from 'express';
import { cartController } from '../controllers/cart.controller.js';
import { createCartWriteLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createCartRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.get('/', cartController.getCart);
  router.post('/', createCartWriteLimiter(), cartController.addToCart);

  return router;
}
