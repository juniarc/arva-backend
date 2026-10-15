import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseBody } from '../middleware/validate.js';
import {
  addressSchema,
  createDraftSchema,
  damageProtectionSchema,
  paymentMethodChoiceSchema,
  shippingChoiceSchema,
  voucherChoiceSchema,
} from '../schemas/checkout.schema.js';
import { orderService } from '../services/order.service.js';
import { checkoutService } from '../services/checkout.service.js';

// requireAuth sets req.user. The user id always comes from the verified token.
function getUserId(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError('Please log in.');
  }
  return req.user.id;
}

async function createDraft(req: Request, res: Response): Promise<void> {
  const { itemIds } = parseBody(createDraftSchema, req);
  res.status(200).json(await checkoutService.createDraft(getUserId(req), itemIds));
}

async function getDraft(req: Request, res: Response): Promise<void> {
  res.status(200).json(await checkoutService.getDraft(getUserId(req)));
}

async function setAddress(req: Request, res: Response): Promise<void> {
  const input = parseBody(addressSchema, req);
  res.status(200).json(await checkoutService.setAddress(getUserId(req), input));
}

async function getShippingOptions(req: Request, res: Response): Promise<void> {
  res.status(200).json(await checkoutService.getShippingOptions(getUserId(req)));
}

async function setShipping(req: Request, res: Response): Promise<void> {
  const { optionId } = parseBody(shippingChoiceSchema, req);
  res.status(200).json(await checkoutService.setShipping(getUserId(req), optionId));
}

async function getPaymentMethods(req: Request, res: Response): Promise<void> {
  res.status(200).json(await checkoutService.getPaymentMethods(getUserId(req)));
}

async function setPaymentMethod(req: Request, res: Response): Promise<void> {
  const { methodId } = parseBody(paymentMethodChoiceSchema, req);
  res.status(200).json(await checkoutService.setPaymentMethod(getUserId(req), methodId));
}

async function setDamageProtection(req: Request, res: Response): Promise<void> {
  const { enabled } = parseBody(damageProtectionSchema, req);
  res.status(200).json(await checkoutService.setDamageProtection(getUserId(req), enabled));
}

async function getVouchers(req: Request, res: Response): Promise<void> {
  res.status(200).json(await checkoutService.getVouchers(getUserId(req)));
}

async function setVoucher(req: Request, res: Response): Promise<void> {
  const { voucherId } = parseBody(voucherChoiceSchema, req);
  res.status(200).json(await checkoutService.setVoucher(getUserId(req), voucherId));
}

async function placeOrder(req: Request, res: Response): Promise<void> {
  res.status(201).json({ order: await orderService.placeOrder(getUserId(req)) });
}

export const checkoutController = {
  createDraft,
  setDamageProtection,
  getVouchers,
  setVoucher,
  placeOrder,
  getDraft,
  setAddress,
  getShippingOptions,
  setShipping,
  getPaymentMethods,
  setPaymentMethod,
};
