import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseBody } from '../middleware/validate.js';
import { addWishlistSchema, removeWishlistItemsSchema } from '../schemas/wishlist.schema.js';
import { wishlistService } from '../services/wishlist.service.js';

// requireAuth sets req.user. The user id always comes from the verified token.
function getUserId(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError('Please log in.');
  }
  return req.user.id;
}

async function getWishlist(req: Request, res: Response): Promise<void> {
  res.status(200).json(await wishlistService.getWishlist(getUserId(req)));
}

async function addItem(req: Request, res: Response): Promise<void> {
  const input = parseBody(addWishlistSchema, req);
  res.status(200).json(await wishlistService.addItem(getUserId(req), input));
}

async function removeItems(req: Request, res: Response): Promise<void> {
  const { itemIds } = parseBody(removeWishlistItemsSchema, req);
  res.status(200).json(await wishlistService.removeItems(getUserId(req), itemIds));
}

export const wishlistController = { getWishlist, addItem, removeItems };
