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
