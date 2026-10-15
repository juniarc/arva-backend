import { describe, expect, it } from 'vitest';
import { updateProfileSchema, upsertAddressSchema } from '../../src/schemas/profile.schema.js';

describe('updateProfileSchema', () => {
  const valid = { name: ' Alice W ', username: ' Alice_01 ', email: ' Alice@Example.COM ', phone: '+6281234567890' };

  it('trims the text fields and lowercases the email', () => {
    const result = updateProfileSchema.safeParse(valid);

    expect(result.success && result.data).toEqual({
      name: 'Alice W',
      username: 'Alice_01',
      email: 'alice@example.com',
      phone: '+6281234567890',
    });
  });

  it('accepts a null phone', () => {
    expect(updateProfileSchema.safeParse({ ...valid, phone: null }).success).toBe(true);
  });

  it.each(['+62 812', '0812-3456', 'abc', '12345', '', '+12'])('rejects the phone "%s"', (phone) => {
    const result = updateProfileSchema.safeParse({ ...valid, phone });

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toBe('Invalid phone number format.');
  });

  it('requires the phone key', () => {
    const { phone, ...withoutPhone } = valid;
    expect(phone).toBeDefined();

    expect(updateProfileSchema.safeParse(withoutPhone).success).toBe(false);
  });

  it('rejects a bad name, username or email', () => {
    expect(updateProfileSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...valid, name: 'x'.repeat(51) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...valid, username: 'bad name' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(updateProfileSchema.safeParse({ ...valid, photoUrl: 'x' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...valid, userId: 1 }).success).toBe(false);
  });
});

describe('upsertAddressSchema', () => {
  const valid = {
    street: ' Jl. Mawar 1 ',
    subDistrict: { id: '4' },
    district: { id: '3' },
    city: { id: '2' },
    province: { id: '1' },
    zipCode: '12345',
  };

  it('accepts a valid address and trims the street', () => {
    const result = upsertAddressSchema.safeParse(valid);

    expect(result.success && result.data.street).toBe('Jl. Mawar 1');
  });

  it.each(['1234', '123456', '12a45', '1234 ', ' 12345', ''])('rejects the zip code "%s"', (zipCode) => {
    expect(upsertAddressSchema.safeParse({ ...valid, zipCode }).success).toBe(false);
  });

  it('rejects an empty or too long street, a bad region id and unknown keys', () => {
    expect(upsertAddressSchema.safeParse({ ...valid, street: '  ' }).success).toBe(false);
    expect(upsertAddressSchema.safeParse({ ...valid, street: 'x'.repeat(201) }).success).toBe(false);
    expect(upsertAddressSchema.safeParse({ ...valid, city: { id: 'abc' } }).success).toBe(false);
    expect(upsertAddressSchema.safeParse({ ...valid, label: 'Home' }).success).toBe(false);
  });
});
