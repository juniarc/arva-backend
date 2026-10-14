import { z } from 'zod';
import { MAX_PRODUCT_IMAGES } from '../lib/image-file.js';

// POST /products. The product arrives as JSON in the multipart field "data"; the photos are files.

export const PRODUCT_UNITS = ['kg', 'g', 'pcs', 'l', 'ml'] as const;
export const MAX_VARIANTS = 10;
export const MAX_TAGS = 10;

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be at most ${max}.`);

const variantSchema = z
  .object({
    label: text('Variant label', 30),
    // Integer IDR before any discount.
    price: wholeNumber('Price', 100, 1_000_000_000),
    stock: wholeNumber('Stock', 0, 1_000_000),
    unit: z.enum(PRODUCT_UNITS, { error: 'Choose a unit.' }),
  })
  .strict();

export const createProductSchema = z
  .object({
    name: text('Product name', 200),
    description: text('Product description', 3000),
    categoryId: z.string({ error: 'Choose a category.' }).regex(/^\d{1,9}$/, 'Choose a category.'),
    tags: z
      .array(text('Tag', 30), { error: 'Tags must be a list.' })
      .max(MAX_TAGS, `Add at most ${MAX_TAGS} tags.`)
      .default([]),
    variants: z
      .array(variantSchema, { error: 'Add at least one variant.' })
      .min(1, 'Add at least one variant.')
      .max(MAX_VARIANTS, `Add at most ${MAX_VARIANTS} variants.`)
      .refine(
        (variants) => new Set(variants.map((variant) => variant.label.toLowerCase())).size === variants.length,
        'Each variant needs a different label.',
      ),
    // Percent off every variant. Null means no discount.
    discountPercent: wholeNumber('Discount', 1, 90).nullable().default(null),
    shipping: z
      .object({
        weightGrams: wholeNumber('Package weight', 1, 1_000_000),
        lengthCm: wholeNumber('Package length', 1, 1000),
        widthCm: wholeNumber('Package width', 1, 1000),
        heightCm: wholeNumber('Package height', 1, 1000),
        fee: wholeNumber('Shipping fee', 0, 100_000_000),
      }, { error: 'Shipping details are required.' })
      .strict(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;

const numericId = (label: string) =>
  z.string({ error: `${label} must be a numeric string.` }).regex(/^\d{1,9}$/, `${label} must be a numeric string.`);

// PUT /products/mine/:id. The same fields as creating, plus:
// - a variant with an id is that existing variant, updated; one without an id is new; an existing
//   variant that is not in the list is deleted (with the cart items that hold it);
// - keepImageIds are the existing photos to keep, in the order to show them. New photos come after.
export const updateProductSchema = createProductSchema
  .extend({
    variants: z
      .array(variantSchema.extend({ id: numericId('Variant id').optional() }).strict(), {
        error: 'Add at least one variant.',
      })
      .min(1, 'Add at least one variant.')
      .max(MAX_VARIANTS, `Add at most ${MAX_VARIANTS} variants.`)
      .refine(
        (variants) => new Set(variants.map((variant) => variant.label.toLowerCase())).size === variants.length,
        'Each variant needs a different label.',
      ),
    keepImageIds: z
      .array(numericId('Image id'), { error: 'keepImageIds must be a list.' })
      .max(MAX_PRODUCT_IMAGES, `Add up to ${MAX_PRODUCT_IMAGES} photos.`)
      .default([]),
  })
  .strict();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const ownedProductParamsSchema = z.object({ id: numericId('Product id') });

// The "data" field is text. It must be JSON before the schema above can check it.
export function parseProductData(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
