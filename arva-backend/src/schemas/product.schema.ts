import { z } from 'zod';

export const PRODUCT_SORTS = ['popular', 'newest', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const productId = z
  .string({ error: 'Must be a numeric product id.' })
  .regex(/^\d{1,9}$/, 'Must be a numeric product id.');

export const productSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

// Lenient: unknown query keys are ignored, so the frontend can add its own parameters.
export const productListQuerySchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  shop: z.string().trim().min(1).max(100).optional(),
  exclude: productId.optional(),
  sort: z
    .enum(PRODUCT_SORTS, { error: 'Sort must be popular, newest, price_asc or price_desc.' })
    .default('popular'),
  // "true" and "false" only. z.coerce.boolean() would treat "false" as true.
  discount: z
    .enum(['true', 'false'], { error: 'Discount must be true or false.' })
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce
    .number({ error: 'Page must be a number.' })
    .int('Page must be a whole number.')
    .min(1, 'Page must be at least 1.')
    .default(1),
  limit: z.coerce
    .number({ error: 'Limit must be a number.' })
    .int('Limit must be a whole number.')
    .min(1, 'Limit must be at least 1.')
    .max(48, 'Limit must be at most 48.')
    .default(12),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// Strict: unknown query keys are rejected with 400.
export const recommendedQuerySchema = z
  .object({
    exclude: productId.optional(),
    excludeShop: z.string().trim().min(1).max(100).optional(),
    limit: z.coerce
      .number({ error: 'Limit must be a number.' })
      .int('Limit must be a whole number.')
      .min(1, 'Limit must be at least 1.')
      .max(24, 'Limit must be at most 24.')
      .default(6),
  })
  .strict();

export type RecommendedQuery = z.infer<typeof recommendedQuerySchema>;
