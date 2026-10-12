import { Router } from 'express';
import { productController } from '../controllers/product.controller.js';
import { createPublicReadLimiter } from '../middleware/rateLimit.js';

export function createProductRouter(): Router {
  const router = Router();

  router.use(createPublicReadLimiter());
  router.get('/', productController.list);
  // Must stay above '/:slug', or Express would read "recommended" as a product slug.
  router.get('/recommended', productController.getRecommended);
  router.get('/:slug/reviews', productController.getReviews);
  router.get('/:slug', productController.getBySlug);

  return router;
}
