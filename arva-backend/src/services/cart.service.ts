import { NotFoundError, StockConflictError, ValidationError } from '../lib/errors.js';
import { cartRepository } from '../repositories/cart.repository.js';
import {
  MAX_CART_QUANTITY,
  USE_DELETE_MESSAGE,
  type AddToCartInput,
  type PatchCartItemInput,
} from '../schemas/cart.schema.js';
import { toCartResponse, type CartResponse } from './cart.mapper.js';

export type { CartItemResponse, CartResponse } from './cart.mapper.js';

async function getCart(userId: number): Promise<CartResponse> {
  return toCartResponse(await cartRepository.findByUser(userId));
}

async function addToCart(userId: number, input: AddToCartInput): Promise<CartResponse> {
  const variantId = Number(input.variantId);

  // Stock is checked here but NOT reserved. It is checked again at checkout.
  // The check and the write share one transaction, and the variant row is locked,
  // so two parallel adds cannot both pass the check.
  await cartRepository.runInTransaction(async (tx) => {
    const variant = await tx.lockActiveVariant(variantId);
    if (!variant) {
      throw new NotFoundError('Product not found.');
    }
    if (variant.stock === 0) {
      throw new StockConflictError('OUT_OF_STOCK', 'This variant is out of stock.');
    }

    const inCart = await tx.findQuantity(userId, variantId);
    const newTotal = inCart + input.quantity;

    if (newTotal > variant.stock) {
      const remaining = Math.max(variant.stock - inCart, 0);
      throw new StockConflictError('INSUFFICIENT_STOCK', `Only ${remaining} left in stock.`);
    }
    if (newTotal > MAX_CART_QUANTITY) {
      throw new ValidationError('Please fix the highlighted fields.', {
        quantity: `You can add at most ${MAX_CART_QUANTITY} of one item to your cart.`,
      });
    }

    await tx.saveQuantity(userId, variantId, newTotal);
  });

  return getCart(userId);
}

const CART_ITEM_NOT_FOUND = 'Cart item not found.';

async function updateItemQuantity(
  userId: number,
  itemId: string,
  input: PatchCartItemInput,
): Promise<CartResponse> {
  if (input.quantity < 1) {
    throw new ValidationError('Please fix the highlighted fields.', { quantity: USE_DELETE_MESSAGE });
  }
  const id = Number(itemId);

  // Same pattern as addToCart: the variant row is locked, so the stock check and the
  // update cannot interleave with another write on the same variant. Stock is not reserved.
  return cartRepository.runInTransaction(async (tx) => {
    // Only this user's items match, so another user's item looks the same as a missing one.
    const variantId = await tx.findItemVariantId(userId, id);
    if (variantId === null) {
      throw new NotFoundError(CART_ITEM_NOT_FOUND);
    }
    // Also null when the product is inactive: same 404, same message.
    const variant = await tx.lockActiveVariant(variantId);
    if (!variant) {
      throw new NotFoundError(CART_ITEM_NOT_FOUND);
    }
    if (variant.stock === 0) {
      throw new StockConflictError('OUT_OF_STOCK', 'This variant is out of stock.');
    }
    if (input.quantity > variant.stock) {
      throw new StockConflictError('INSUFFICIENT_STOCK', `Only ${variant.stock} left in stock.`);
    }
    if (!(await tx.updateItemQuantity(userId, id, input.quantity))) {
      throw new NotFoundError(CART_ITEM_NOT_FOUND);
    }

    return toCartResponse(await tx.findByUser(userId));
  });
}

// Ids that belong to other users, or do not exist, match nothing and are ignored.
// The response is the same either way, so it never reveals which ids exist.
async function removeItems(userId: number, itemIds: string[]): Promise<CartResponse> {
  const uniqueIds = [...new Set(itemIds.map(Number))];

  return cartRepository.runInTransaction(async (tx) => {
    await tx.deleteItems(userId, uniqueIds);
    return toCartResponse(await tx.findByUser(userId));
  });
}

export const cartService = { getCart, addToCart, updateItemQuantity, removeItems };
