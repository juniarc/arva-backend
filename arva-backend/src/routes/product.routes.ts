import { Router } from 'express';
import { productController } from '../controllers/product.controller.js';
import { productUpload } from '../middleware/productUpload.js';
import { createProductWriteLimiter, createPublicReadLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createProductRouter(): Router {
  const router = Router();

  // Listing a product: the owner's own limit, not the public read limit below.
  router.post('/', requireAuth, createProductWriteLimiter(), productUpload, productController.create);
  // The owner's own products. Above '/:slug', so "mine" is never read as a product slug.
  router.get('/mine/:id', requireAuth, productController.getOwned);
  router.put('/mine/:id', requireAuth, createProductWriteLimiter(), productUpload, productController.update);
  router.delete('/mine/:id', requireAuth, createProductWriteLimiter(), productController.remove);

  router.use(createPublicReadLimiter());
  router.get('/', productController.list);
  // Must stay above '/:slug', or Express would read "recommended" or "cities" as a product slug.
  router.get('/recommended', productController.getRecommended);
  router.get('/cities', productController.getCities);
  router.get('/:slug/reviews', productController.getReviews);
  router.get('/:slug', productController.getBySlug);

  return router;
}
