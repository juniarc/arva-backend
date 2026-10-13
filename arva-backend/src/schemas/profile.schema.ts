import { z } from 'zod';
import { PROFILE_PHONE_PATTERN } from '../lib/phone.js';
import { emailRule, usernameRule } from './auth.schema.js';
import { regionIdRule } from './region.schema.js';

const regionRef = (label: string) =>
  z.object({ id: regionIdRule(`${label} id`) }, { error: `${label} is required.` }).strict();

// The username and email rules are the register rules (trimmed, email lowercased).
export const updateProfileSchema = z
  .object({
    name: z
      .string({ error: 'Name is required.' })
      .trim()
      .min(1, 'Name is required.')
      .max(50, 'Name must be at most 50 characters.'),
    username: usernameRule,
    email: emailRule,
    // Required, but null clears the phone.
    phone: z
      .string({ error: 'Invalid phone number format.' })
      .trim()
      .regex(PROFILE_PHONE_PATTERN, 'Invalid phone number format.')
      .nullable(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const upsertAddressSchema = z
  .object({
    street: z
      .string({ error: 'Street is required.' })
      .trim()
      .min(1, 'Street is required.')
      .max(200, 'Street must be at most 200 characters.'),
    subDistrict: regionRef('Sub-district'),
    district: regionRef('District'),
    city: regionRef('City'),
    province: regionRef('Province'),
    zipCode: z.string({ error: 'Zip code is required.' }).regex(/^[0-9]{5}$/, 'Zip code must be exactly 5 digits.'),
  })
  .strict();

export type UpsertAddressInput = z.infer<typeof upsertAddressSchema>;
