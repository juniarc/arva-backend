import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import { createCartRouter } from './cart.routes.js';
import { categoryRouter } from './category.routes.js';
import { healthRouter } from './health.routes.js';
import { homeRouter } from './home.routes.js';
import { createProductRouter } from './product.routes.js';
import { createShopRouter } from './shop.routes.js';
import { createWishlistRouter } from './wishlist.routes.js';

// app.ts mounts this router at /api.
export function createApiRouter(): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter());
  router.use('/home', homeRouter);
  router.use('/categories', categoryRouter);
  router.use('/products', createProductRouter());
  router.use('/shops', createShopRouter());
  router.use('/cart', createCartRouter());
  router.use('/wishlist', createWishlistRouter());

  return router;
}
