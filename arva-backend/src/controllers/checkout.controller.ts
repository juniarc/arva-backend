import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseBody } from '../middleware/validate.js';
import { addressSchema, createDraftSchema } from '../schemas/checkout.schema.js';
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

export const checkoutController = { createDraft, getDraft, setAddress };
