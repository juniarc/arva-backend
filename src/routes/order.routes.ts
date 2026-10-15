import { Router } from 'express';
import { orderController } from '../controllers/order.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createOrderRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.get('/', orderController.list);

  return router;
}
