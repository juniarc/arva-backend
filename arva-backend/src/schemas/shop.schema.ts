import { z } from 'zod';
import { PROFILE_PHONE_PATTERN } from '../lib/phone.js';
import { HH_MM_PATTERN, isClosingAfterOpening } from '../lib/shop-hours.js';
import { emailRule } from './auth.schema.js';
import { regionIdRule } from './region.schema.js';

export const shopParamsSchema = z.object({
  slug: z.string().trim().min(1).max(100),
});

// Strict: unknown query keys are rejected with 400.
export const shopProductsQuerySchema = z
  .object({
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
    sort: z.enum(['newest', 'popular'], { error: 'Sort must be newest or popular.' }).default('newest'),
  })
  .strict();

export type ShopProductsQuery = z.infer<typeof shopProductsQuerySchema>;

const numericId = (label: string) =>
  z.string({ error: `${label} is required.` }).regex(/^\d{1,9}$/, `${label} must be a numeric string.`);

const time = (label: string) =>
  z.string({ error: `${label} is required.` }).regex(HH_MM_PATTERN, `${label} must be HH:MM (24 hour).`);

export const MAX_SHIPPING_CHANNELS = 50;

export const updateOwnerShopSchema = z
  .object({
    name: z
      .string({ error: 'Name is required.' })
      .trim()
      .min(3, 'Name must be at least 3 characters.')
      .max(50, 'Name must be at most 50 characters.'),
    // Omitted keeps the current description.
    description: z.string({ error: 'Description must be text.' }).trim().max(2000, 'Description must be at most 2000 characters.').optional(),
    provinceId: regionIdRule('Province id'),
    cityId: regionIdRule('City id'),
    districtId: regionIdRule('District id'),
    subDistrictId: regionIdRule('Sub-district id'),
    street: z
      .string({ error: 'Street is required.' })
      .trim()
      .min(1, 'Street is required.')
      .max(200, 'Street must be at most 200 characters.'),
    // Omitted keeps the current zip code.
    zipCode: z.string({ error: 'Zip code must be text.' }).regex(/^[0-9]{5}$/, 'Zip code must be exactly 5 digits.').optional(),
    email: emailRule,
    // Same rule as the profile phone. Required, and null clears it.
    phone: z
      .string({ error: 'Invalid phone number format.' })
      .trim()
      .regex(PROFILE_PHONE_PATTERN, 'Invalid phone number format.')
      .nullable(),
    openingTime: time('Opening time'),
    closingTime: time('Closing time'),
    shippingChannelIds: z
      .array(numericId('Each shipping channel id'), { error: 'shippingChannelIds must be an array of numeric strings.' })
      .min(1, 'Choose at least one shipping channel.')
      .max(MAX_SHIPPING_CHANNELS, `Choose at most ${MAX_SHIPPING_CHANNELS} shipping channels.`)
      .refine((ids) => new Set(ids).size === ids.length, 'Each shipping channel can only be chosen once.'),
  })
  .strict()
  .superRefine((data, context) => {
    // Only compared when both are valid times. Bad formats are reported on their own field.
    const bothValid = HH_MM_PATTERN.test(data.openingTime) && HH_MM_PATTERN.test(data.closingTime);
    if (bothValid && !isClosingAfterOpening(data.openingTime, data.closingTime)) {
      context.addIssue({
        code: 'custom',
        path: ['closingTime'],
        message: 'Closing time must be later than opening time.',
      });
    }
  });

export type UpdateOwnerShopInput = z.infer<typeof updateOwnerShopSchema>;

// Creating a shop takes the same form as updating it. description and zipCode are optional.
export const createShopSchema = updateOwnerShopSchema;

export type CreateShopInput = z.infer<typeof createShopSchema>;
