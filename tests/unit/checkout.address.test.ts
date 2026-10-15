import { describe, expect, it } from 'vitest';
import { checkRegionParents } from '../../src/services/checkout.service.js';
import { toDraftResponse } from '../../src/services/checkout.mapper.js';
import { addressSchema } from '../../src/schemas/checkout.schema.js';
import { buildDraft, fullAddress } from '../helpers/draftRecord.js';

describe('address completeness in the draft response', () => {
  it('returns the address when all eight fields are set', () => {
    const response = toDraftResponse(buildDraft([], fullAddress));

    expect(response.address).toEqual({
      label: 'Home',
      street: 'Jl. Mawar 1',
      recipientName: 'Alice',
      phone: '081234567890',
      province: { id: '31', name: 'DKI Jakarta' },
      city: { id: '3171', name: 'Kota Administrasi Jakarta Pusat' },
      district: { id: '317107', name: 'Tanah Abang' },
      subDistrict: { id: '3171071001', name: 'Gelora' },
    });
  });

  it('returns null for a draft with no address', () => {
    expect(toDraftResponse(buildDraft([])).address).toBeNull();
  });

  it.each([
    ['addressLabel', null],
    ['addressStreet', null],
    ['recipientName', null],
    ['phone', null],
    ['province', null],
    ['city', null],
    ['district', null],
    ['subDistrict', null],
  ] as const)('returns null when %s is missing', (field, value) => {
    const response = toDraftResponse(buildDraft([], { ...fullAddress, [field]: value }));

    expect(response.address).toBeNull();
  });
});

describe('checkRegionParents', () => {
  // wilayah.id codes: DKI Jakarta, Jakarta Pusat, Tanah Abang, Gelora.
  const ids = { provinceId: '31', cityId: '3171', districtId: '317107', subDistrictId: '3171071001' };
  const consistent = {
    province: { id: '31' },
    city: { provinceId: '31' },
    district: { cityId: '3171' },
    subDistrict: { districtId: '317107' },
  };

  it('accepts a city, district and sub-district that match their parents', () => {
    expect(checkRegionParents(ids, consistent)).toEqual({});
  });

  it('rejects a city from another province', () => {
    const errors = checkRegionParents(ids, { ...consistent, city: { provinceId: '32' } });

    expect(errors).toEqual({ city: 'This city is not in the selected province.' });
  });

  it('rejects a district from another city', () => {
    const errors = checkRegionParents(ids, { ...consistent, district: { cityId: '3172' } });

    expect(errors).toEqual({ district: 'This district is not in the selected city.' });
  });

  it('rejects a sub-district from another district', () => {
    const errors = checkRegionParents(ids, { ...consistent, subDistrict: { districtId: '317108' } });

    expect(errors).toEqual({ subDistrict: 'This sub-district is not in the selected district.' });
  });

  it('reports regions that do not exist', () => {
    const errors = checkRegionParents(ids, { province: null, city: null, district: null, subDistrict: null });

    expect(Object.keys(errors).sort()).toEqual(['city', 'district', 'province', 'subDistrict']);
  });
});

describe('addressSchema', () => {
  const valid = {
    label: ' Home ',
    province: { id: '1' },
    city: { id: '1' },
    district: { id: '1' },
    subDistrict: { id: '1' },
    street: 'Jl. Mawar 1',
    recipientName: 'Alice',
    phone: '081234567890',
  };

  it('trims the text fields', () => {
    const result = addressSchema.safeParse(valid);

    expect(result.success && result.data.label).toBe('Home');
  });

  it.each(['0812 3456 7890', '+6281234567890', '08123abc890', '1234567', '1234567890123456'])(
    'rejects the phone "%s"',
    (phone) => {
      expect(addressSchema.safeParse({ ...valid, phone }).success).toBe(false);
    },
  );

  it('accepts 8 and 15 digit phones', () => {
    expect(addressSchema.safeParse({ ...valid, phone: '12345678' }).success).toBe(true);
    expect(addressSchema.safeParse({ ...valid, phone: '123456789012345' }).success).toBe(true);
  });

  it('rejects empty text, text over the limit and unknown keys', () => {
    expect(addressSchema.safeParse({ ...valid, label: '   ' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, label: 'x'.repeat(31) }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, street: 'x'.repeat(201) }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, recipientName: 'x'.repeat(31) }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, userId: 1 }).success).toBe(false);
  });

  it('rejects a non-numeric region id', () => {
    expect(addressSchema.safeParse({ ...valid, city: { id: 'abc' } }).success).toBe(false);
  });
});

describe('draft items in the response', () => {
  it('leaves out inactive products and counts them in unavailableItemCount', () => {
    const response = toDraftResponse(
      buildDraft([
        { id: 1, quantity: 2, price: 1000 },
        { id: 2, quantity: 3, price: 500, isActive: false },
      ]),
    );

    expect(response.items.map((item) => item.id)).toEqual(['1']);
    expect(response.unavailableItemCount).toBe(1);
    expect(response.summary.productSubtotal).toBe(2000);
    expect(response.summary.total).toBe(2000);
  });

  it('orders items by shop name, product name, then variant position', () => {
    const response = toDraftResponse(
      buildDraft([
        { id: 1, shopName: 'Shop B', productName: 'Apple' },
        { id: 2, shopName: 'Shop A', productName: 'Zucchini' },
        { id: 3, shopName: 'Shop A', productName: 'Banana', productId: 30, position: 1 },
        { id: 4, shopName: 'Shop A', productName: 'Banana', productId: 30, position: 0 },
      ]),
    );

    expect(response.items.map((item) => item.id)).toEqual(['4', '3', '2', '1']);
  });

  it('has no choices yet, shows the damage protection price without charging it, and no internal fields', () => {
    const response = toDraftResponse(buildDraft([{ id: 1 }]));

    expect(response).toMatchObject({
      shipping: null,
      voucher: null,
      paymentMethod: null,
      damageProtection: { enabled: false, fee: 1000 },
      summary: { shippingSubtotal: 0, buyerServiceFee: 0, handlingFee: 0, damageProtectionFee: 0, discount: 0 },
    });
    expect(JSON.stringify(response)).not.toMatch(/userId|isActive|createdAt|updatedAt|draftId/);
  });
});

describe('checkRegionParents: wilayah.id code prefixes', () => {
  const ids = { provinceId: '31', cityId: '3171', districtId: '317107', subDistrictId: '3171071001' };
  const consistent = {
    province: { id: '31' },
    city: { provinceId: '31' },
    district: { cityId: '3171' },
    subDistrict: { districtId: '317107' },
  };

  it('rejects a city whose code does not start with the province code, before trusting the database', () => {
    // Even if a bad row claimed otherwise, 3273 (Kota Bandung) is not in 31 (DKI Jakarta).
    const errors = checkRegionParents({ ...ids, cityId: '3273' }, consistent);

    expect(errors.city).toBe('This city is not in the selected province.');
  });

  it('rejects a district and a sub-district from another parent by prefix', () => {
    const errors = checkRegionParents({ ...ids, districtId: '317407', subDistrictId: '3174071002' }, consistent);

    expect(errors.district).toBe('This district is not in the selected city.');
    expect(errors.subDistrict).toBe('This sub-district is not in the selected district.');
  });

  it('rejects a child code that equals its parent code', () => {
    expect(checkRegionParents({ ...ids, cityId: '31' }, consistent).city).toBe(
      'This city is not in the selected province.',
    );
  });
});

describe('addressSchema: region id format', () => {
  const base = {
    label: 'Home',
    street: 'Jl. Gelora 1',
    recipientName: 'Alice',
    phone: '081234567890',
    province: { id: '31' },
    city: { id: '3171' },
    district: { id: '317107' },
  };

  it('accepts a 10 digit code above the 32 bit integer limit', () => {
    expect(addressSchema.safeParse({ ...base, subDistrict: { id: '3171071001' } }).success).toBe(true);
  });

  it.each(['31710710011', '31.71', 'abc', '', '-1'])('rejects the id "%s"', (id) => {
    expect(addressSchema.safeParse({ ...base, subDistrict: { id } }).success).toBe(false);
  });
});
