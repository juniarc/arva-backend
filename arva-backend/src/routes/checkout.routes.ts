import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller.js';
import { createCheckoutWriteLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createCheckoutRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.post('/', createCheckoutWriteLimiter(), checkoutController.createDraft);
  router.get('/', checkoutController.getDraft);
  router.put('/address', createCheckoutWriteLimiter(), checkoutController.setAddress);
  router.get('/shipping-options', checkoutController.getShippingOptions);
  router.put('/shipping', createCheckoutWriteLimiter(), checkoutController.setShipping);
  router.get('/payment-methods', checkoutController.getPaymentMethods);
  router.put('/payment-method', createCheckoutWriteLimiter(), checkoutController.setPaymentMethod);
  router.put('/damage-protection', createCheckoutWriteLimiter(), checkoutController.setDamageProtection);
  router.get('/vouchers', checkoutController.getVouchers);
  router.put('/voucher', createCheckoutWriteLimiter(), checkoutController.setVoucher);
  router.post('/orders', createCheckoutWriteLimiter(), checkoutController.placeOrder);

  return router;
}
