import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseBody } from '../middleware/validate.js';
import { addToCartSchema } from '../schemas/cart.schema.js';
import { cartService } from '../services/cart.service.js';

// requireAuth sets req.user. The user id always comes from the verified token.
function getUserId(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError('Please log in.');
  }
  return req.user.id;
}

async function getCart(req: Request, res: Response): Promise<void> {
  res.status(200).json(await cartService.getCart(getUserId(req)));
}

async function addToCart(req: Request, res: Response): Promise<void> {
  const input = parseBody(addToCartSchema, req);
  res.status(200).json(await cartService.addToCart(getUserId(req), input));
}

export const cartController = { getCart, addToCart };
