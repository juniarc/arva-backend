import { Router } from 'express';
import { regionController } from '../controllers/region.controller.js';
import { createPublicReadLimiter } from '../middleware/rateLimit.js';

export function createRegionRouter(): Router {
  const router = Router();

  router.use(createPublicReadLimiter());
  router.get('/provinces', regionController.listProvinces);
  router.get('/provinces/:id/cities', regionController.listCities);
  router.get('/cities/:id/districts', regionController.listDistricts);
  router.get('/districts/:id/sub-districts', regionController.listSubDistricts);

  return router;
}
