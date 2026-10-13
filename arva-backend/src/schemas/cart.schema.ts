import { z } from 'zod';

export const MAX_CART_QUANTITY = 99;

export const addToCartSchema = z
  .object({
    // A numeric string such as "12". Up to 9 digits keeps it inside a database integer.
    variantId: z
      .string({ error: 'Variant id is required.' })
      .regex(/^\d{1,9}$/, 'Variant id must be a numeric string.'),
    quantity: z
      .number({ error: 'Quantity is required.' })
      .int('Quantity must be a whole number.')
      .min(1, 'Quantity must be at least 1.')
      .max(MAX_CART_QUANTITY, `Quantity must be at most ${MAX_CART_QUANTITY}.`),
  })
  .strict();

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const MAX_REMOVE_ITEMS = 100;
export const USE_DELETE_MESSAGE = 'Quantity must be at least 1. To remove an item, use DELETE /api/cart/items.';

const numericId = (label: string) =>
  z.string({ error: `${label} is required.` }).regex(/^\d{1,9}$/, `${label} must be a numeric string.`);

export const cartItemParamsSchema = z.object({ id: numericId('Cart item id') });

export const patchCartItemSchema = z
  .object({
    quantity: z
      .number({ error: 'Quantity is required.' })
      .int('Quantity must be a whole number.')
      .min(1, USE_DELETE_MESSAGE)
      .max(MAX_CART_QUANTITY, `Quantity must be at most ${MAX_CART_QUANTITY}.`),
  })
  .strict();

export type PatchCartItemInput = z.infer<typeof patchCartItemSchema>;

export const deleteCartItemsSchema = z
  .object({
    itemIds: z
      .array(numericId('Each item id'), { error: 'itemIds must be an array of numeric strings.' })
      .min(1, 'Send at least one item id.')
      .max(MAX_REMOVE_ITEMS, `Send at most ${MAX_REMOVE_ITEMS} item ids.`),
  })
  .strict();

export type DeleteCartItemsInput = z.infer<typeof deleteCartItemsSchema>;
