import { z } from 'zod';

export const MAX_WISHLIST_REMOVE = 100;

// A numeric string such as "12". Up to 9 digits keeps it inside a database integer.
const numericId = (label: string) =>
  z.string({ error: `${label} is required.` }).regex(/^\d{1,9}$/, `${label} must be a numeric string.`);

export const addWishlistSchema = z.object({ productId: numericId('Product id') }).strict();

export type AddWishlistInput = z.infer<typeof addWishlistSchema>;

export const removeWishlistItemsSchema = z
  .object({
    itemIds: z
      .array(numericId('Each item id'), { error: 'itemIds must be an array of numeric strings.' })
      .min(1, 'Send at least one item id.')
      .max(MAX_WISHLIST_REMOVE, `Send at most ${MAX_WISHLIST_REMOVE} item ids.`),
  })
  .strict();

