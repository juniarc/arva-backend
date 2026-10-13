import { Router } from 'express';
import { shopController } from '../controllers/shop.controller.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { createPublicReadLimiter, createShopWriteLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createShopRouter(): Router {
  const router = Router();

  router.use(createPublicReadLimiter());
  router.post('/', requireAuth, createShopWriteLimiter(), shopController.createShop);
  // The order matters. "/me" must come before "/:slug", or Express would read "me" as a shop slug.
  router.get('/me', requireAuth, shopController.getOwnerShop);
  router.put('/me', requireAuth, createShopWriteLimiter(), shopController.updateOwnerShop);
  router.get('/:slug/products', optionalAuth, shopController.getProducts);
  router.get('/:slug', optionalAuth, shopController.getBySlug);

  return router;
}
