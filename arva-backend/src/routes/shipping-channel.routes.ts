import { Router } from 'express';
import { shippingChannelController } from '../controllers/shipping-channel.controller.js';
import { createPublicReadLimiter } from '../middleware/rateLimit.js';

export function createShippingChannelRouter(): Router {
  const router = Router();

  router.use(createPublicReadLimiter());
  router.get('/', shippingChannelController.list);

  return router;
}
