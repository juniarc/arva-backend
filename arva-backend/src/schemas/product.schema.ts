import { z } from 'zod';
import { PRODUCT_SORTS } from '../lib/product-sort.js';

export { PRODUCT_SORTS, type ProductSort } from '../lib/product-sort.js';

// Largest value of a database integer column.
const MAX_PRICE = 2_147_483_647;

// A whole number written with digits only. z.coerce.number() would turn "" into 0.
const price = (label: string) =>
  z
    .string({ error: `${label} must be a whole number.` })
    .regex(/^\d{1,10}$/, `${label} must be a whole number.`)
    .transform(Number)
    .pipe(z.number().max(MAX_PRICE, `${label} is too large.`));

const productId = z
  .string({ error: 'Must be a numeric product id.' })
  .regex(/^\d{1,9}$/, 'Must be a numeric product id.');

export const productSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

// Strict: unknown query keys are rejected with 400.
export const productListQuerySchema = z
  .object({
    // Search words. A product matches when every word is in its name, description, tags,
    // category name or shop name (any letter case).
    q: z.string({ error: 'Search must be text.' }).trim().min(1, 'Search must not be empty.').max(100, 'Search must be at most 100 characters.').optional(),
    category: z.string().trim().min(1).max(100).optional(),
    shop: z.string().trim().min(1).max(100).optional(),
    exclude: productId.optional(),
    minPrice: price('Minimum price').optional(),
    maxPrice: price('Maximum price').optional(),
    // 1 to 5 stars. Stored ratings are in tenths, the service converts.
    minRating: z
      .string({ error: 'Minimum rating must be a whole number from 1 to 5.' })
      .regex(/^[1-5]$/, 'Minimum rating must be a whole number from 1 to 5.')
      .transform(Number)
      .optional(),
    // Exact, case-sensitive match against the stored shop city.
    city: z.string().trim().min(1, 'City must not be empty.').max(100).optional(),
    sort: z
      .enum(PRODUCT_SORTS, {
        error: 'Sort must be popular, newest, price_asc, price_desc or relevance.',
      })
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
  })
  .strict();

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
