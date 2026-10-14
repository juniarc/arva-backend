import { z } from 'zod';
import { regionIdRule } from './region.schema.js';

export const MAX_DRAFT_ITEMS = 100;

const numericId = (label: string) =>
  z.string({ error: `${label} is required.` }).regex(/^\d{1,9}$/, `${label} must be a numeric string.`);

export const createDraftSchema = z
  .object({
    itemIds: z
      .array(numericId('Each item id'), { error: 'itemIds must be an array of numeric strings.' })
      .min(1, 'Choose at least one item.')
      .max(MAX_DRAFT_ITEMS, `Choose at most ${MAX_DRAFT_ITEMS} items.`),
  })
  .strict();

export type CreateDraftInput = z.infer<typeof createDraftSchema>;

const regionRef = (label: string) =>
  z.object({ id: regionIdRule(`${label} id`) }, { error: `${label} is required.` }).strict();

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const addressSchema = z
  .object({
    label: text('Label', 30),
    province: regionRef('Province'),
    city: regionRef('City'),
    district: regionRef('District'),
    subDistrict: regionRef('Sub-district'),
    street: text('Street', 200),
    recipientName: text('Recipient name', 30),
    // Digits only. No spaces, plus signs or letters, and no trimming.
    phone: z
      .string({ error: 'Phone is required.' })
      .regex(/^[0-9]{8,15}$/, 'Phone must be 8 to 15 digits, with no spaces or symbols.'),
  })
  .strict();

export type AddressInput = z.infer<typeof addressSchema>;

export const shippingChoiceSchema = z.object({ optionId: numericId('Shipping option id') }).strict();
export const paymentMethodChoiceSchema = z.object({ methodId: numericId('Payment method id') }).strict();
export const damageProtectionSchema = z.object({ enabled: z.boolean({ error: 'enabled must be true or false.' }) }).strict();
// null removes the voucher.
export const voucherChoiceSchema = z.object({ voucherId: numericId('Voucher id').nullable() }).strict();
