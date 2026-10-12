import { Router } from 'express';
import { shopController } from '../controllers/shop.controller.js';
import { createPublicReadLimiter } from '../middleware/rateLimit.js';

export function createShopRouter(): Router {
  const router = Router();

  router.use(createPublicReadLimiter());
  router.get('/:slug', shopController.getBySlug);

  return router;
}
