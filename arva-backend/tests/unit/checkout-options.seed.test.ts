import { describe, expect, it } from 'vitest';
import { buildVouchers, paymentMethods, shippingOptions } from '../../prisma/data/checkout-options.js';
import { shippingChannels } from '../../prisma/data/shipping-channels.js';
import { shops } from '../../prisma/data/dummy-products.js';

const NOW = new Date('2026-06-15T12:00:00Z');
const vouchers = buildVouchers(NOW);

function voucher(code: string) {
  const found = vouchers.find((v) => v.code === code);
  if (!found) throw new Error(`No seed voucher ${code}`);
  return found;
}

describe('seeded shipping options', () => {
  it('belong to seeded channels, with no duplicate channel and name', () => {
    const channelNames = new Set(shippingChannels.map((channel) => channel.name));
    const keys = shippingOptions.map((option) => `${option.channel}/${option.name}`);

    expect(shippingOptions.every((option) => channelNames.has(option.channel))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('have integer prices and valid delivery days', () => {
    for (const option of shippingOptions) {
      expect(Number.isInteger(option.price) && option.price >= 0).toBe(true);
      expect(option.minDays).toBeGreaterThanOrEqual(0);
      expect(option.maxDays).toBeGreaterThanOrEqual(option.minDays);
    }
  });

  it('include an option that is switched off', () => {
    expect(shippingOptions.some((option) => !option.isActive)).toBe(true);
    expect(shippingOptions.filter((option) => option.isActive).length).toBeGreaterThan(2);
  });
});

describe('seeded payment methods', () => {
  it('are the three methods every shop offers, all enabled, with unique sort orders', () => {
    expect(paymentMethods.map((m) => m.name)).toEqual(['Mandiri Virtual Account', 'BCA Virtual Account', 'QRIS']);
    expect(paymentMethods.every((m) => m.isEnabled)).toBe(true);
    expect(new Set(paymentMethods.map((m) => m.sortOrder)).size).toBe(paymentMethods.length);
  });
});

describe('seeded vouchers', () => {
  it('have unique upper case codes', () => {
    expect(new Set(vouchers.map((v) => v.code)).size).toBe(vouchers.length);
    expect(vouchers.every((v) => v.code === v.code.toUpperCase())).toBe(true);
  });

  it('satisfy the database CHECK rules', () => {
    for (const v of vouchers) {
      expect(Number.isInteger(v.value) && v.value > 0, v.code).toBe(true);
      if (v.type === 'PERCENT') expect(v.value, v.code).toBeLessThanOrEqual(100);
      expect(v.minSpend, v.code).toBeGreaterThanOrEqual(0);
      expect(v.endsAt.getTime(), v.code).toBeGreaterThan(v.startsAt.getTime());
      expect(v.usedCount, v.code).toBeGreaterThanOrEqual(0);
      if (v.usageLimit !== null) expect(v.usedCount, v.code).toBeLessThanOrEqual(v.usageLimit);
    }
  });

  it('only point at seeded shops', () => {
    const slugs = new Set(shops.map((shop) => shop.slug));

    for (const v of vouchers) {
      if (v.shopSlug !== null) expect(slugs.has(v.shopSlug), v.code).toBe(true);
    }
  });

  it('have platform and shop vouchers of every type', () => {
    expect(vouchers.some((v) => v.shopSlug === null)).toBe(true);
    expect(vouchers.some((v) => v.shopSlug !== null)).toBe(true);
    expect(new Set(vouchers.map((v) => v.type))).toEqual(new Set(['PERCENT', 'FIXED', 'FREE_SHIPPING']));
  });

  it('include working vouchers that are valid on the day the seed runs', () => {
    for (const code of ['WELCOME15', 'HEMAT20K', 'FREESHIP', 'BALI10', 'TANI5K']) {
      const v = voucher(code);
      expect(v.startsAt <= NOW && NOW < v.endsAt, code).toBe(true);
      expect(v.isActive, code).toBe(true);
    }
  });

  it('include the edge cases: expired, not started, used up, switched off', () => {
    expect(voucher('EXPIRED10').endsAt < NOW).toBe(true);
    expect(voucher('SOON25').startsAt > NOW).toBe(true);
    expect(voucher('USEDUP50').usedCount).toBe(voucher('USEDUP50').usageLimit);
    expect(voucher('PAUSED5K').isActive).toBe(false);
  });

  it('move the windows with the date the seed runs', () => {
    const later = buildVouchers(new Date('2027-01-01T00:00:00Z'));

    expect(later.find((v) => v.code === 'WELCOME15')?.endsAt.getTime()).toBeGreaterThan(
      voucher('WELCOME15').endsAt.getTime(),
    );
  });
});
