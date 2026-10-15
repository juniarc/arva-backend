import { Router } from 'express';
import { wishlistController } from '../controllers/wishlist.controller.js';
import { createCartWriteLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createWishlistRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.get('/', wishlistController.getWishlist);
  // Same limit as the cart writes: 60 requests per minute per user.
  router.post('/', createCartWriteLimiter(), wishlistController.addItem);
  // DELETE has a JSON body, so the client must send Content-Type: application/json.
  router.delete('/items', createCartWriteLimiter(), wishlistController.removeItems);

  return router;
}
