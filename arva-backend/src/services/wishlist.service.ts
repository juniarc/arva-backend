import { NotFoundError } from '../lib/errors.js';
import { wishlistRepository } from '../repositories/wishlist.repository.js';
import type { AddWishlistInput } from '../schemas/wishlist.schema.js';
import { toWishlistResponse, type WishlistResponse } from './wishlist.mapper.js';

export type { WishlistItemResponse, WishlistProduct, WishlistResponse } from './wishlist.mapper.js';

async function getWishlist(userId: number): Promise<WishlistResponse> {
  return toWishlistResponse(await wishlistRepository.findByUser(userId));
}

// Idempotent. Stock does not matter: a sold-out product can be wishlisted.
async function addItem(userId: number, input: AddWishlistInput): Promise<WishlistResponse> {
  const productId = Number(input.productId);
  if (!(await wishlistRepository.activeProductExists(productId))) {
    throw new NotFoundError('Product not found.');
  }

  await wishlistRepository.addIfAbsent(userId, productId);
  return getWishlist(userId);
}

// Ids that belong to other users, or do not exist, match nothing and are ignored.
// The response is the same either way, so it never reveals which ids exist.
async function removeItems(userId: number, itemIds: string[]): Promise<WishlistResponse> {
  const uniqueIds = [...new Set(itemIds.map(Number))];
  return toWishlistResponse(await wishlistRepository.removeAndFind(userId, uniqueIds));
}

export const wishlistService = { getWishlist, addItem, removeItems };
