import { Router } from 'express';
import { cartController } from '../controllers/cart.controller.js';
import { createCartWriteLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createCartRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.get('/', cartController.getCart);
  router.post('/', createCartWriteLimiter(), cartController.addToCart);
  router.patch('/items/:id', createCartWriteLimiter(), cartController.updateItemQuantity);
  // DELETE has a JSON body, so the client must send Content-Type: application/json.
  router.delete('/items', createCartWriteLimiter(), cartController.removeItems);

  return router;
}
