// Seed data for testing checkout: shipping options, vouchers and payment methods.
// PROVISIONAL: the checkout tasks that use these tables may change the fields.
// It never creates users, orders or drafts.
import type { PrismaClient, VoucherType } from '@prisma/client';

// ---------- Shipping options (prices are integer IDR) ----------

export interface SeedShippingOption {
  channel: string; // the shipping channel name
  name: string;
  price: number;
  minDays: number;
  maxDays: number;
  isActive: boolean;
}

export const shippingOptions: SeedShippingOption[] = [
  { channel: 'JNE', name: 'Regular', price: 12000, minDays: 3, maxDays: 5, isActive: true },
  { channel: 'JNE', name: 'Express', price: 25000, minDays: 1, maxDays: 2, isActive: true },
  { channel: 'JNE', name: 'Same Day', price: 40000, minDays: 0, maxDays: 1, isActive: true },
  { channel: 'J&T Express', name: 'Regular', price: 11000, minDays: 3, maxDays: 5, isActive: true },
  { channel: 'J&T Express', name: 'Express', price: 22000, minDays: 1, maxDays: 2, isActive: true },
  // Edge case: an option that exists but cannot be chosen.
  { channel: 'J&T Express', name: 'Cargo', price: 90000, minDays: 5, maxDays: 10, isActive: false },
];

// ---------- Payment methods (no payment provider is connected) ----------

export interface SeedPaymentMethod {
  code: string;
  name: string;
  description: string;
  isEnabled: boolean;
  sortOrder: number;
}

// Every shop offers the same three methods (see migration 20261022000000_checkout_shipping_payment).
export const paymentMethods: SeedPaymentMethod[] = [
  { code: 'MANDIRI_VA', name: 'Mandiri Virtual Account', description: 'Pay by transfer to a Mandiri virtual account.', isEnabled: true, sortOrder: 1 },
  { code: 'BCA_VA', name: 'BCA Virtual Account', description: 'Pay by transfer to a BCA virtual account.', isEnabled: true, sortOrder: 2 },
  { code: 'QRIS', name: 'QRIS', description: 'Scan the QR code with any QRIS-ready banking or e-wallet app.', isEnabled: true, sortOrder: 3 },
];

// ---------- Vouchers ----------

export interface SeedVoucher {
  code: string;
  title: string;
  type: VoucherType;
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  // The slug of a seeded shop, or null for a platform voucher.
  shopSlug: string | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

// Dates are relative to `now`, so the "valid" vouchers are valid on the day the seed runs.
// Running the seed again moves the windows forward. It does not reset usedCount.
export function buildVouchers(now: Date): SeedVoucher[] {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const ahead = (days: number) => new Date(now.getTime() + days * DAY);
  const valid = { startsAt: ago(7), endsAt: ahead(60), usedCount: 0, isActive: true };

  return [
    // Platform vouchers
    { code: 'WELCOME15', title: '15% off, up to Rp30.000', type: 'PERCENT', value: 15, maxDiscount: 30000, minSpend: 100000, shopSlug: null, usageLimit: null, ...valid },
    { code: 'HEMAT20K', title: 'Rp20.000 off', type: 'FIXED', value: 20000, maxDiscount: null, minSpend: 150000, shopSlug: null, usageLimit: 500, ...valid },
    { code: 'FREESHIP', title: 'Free shipping up to Rp15.000', type: 'FREE_SHIPPING', value: 15000, maxDiscount: null, minSpend: 75000, shopSlug: null, usageLimit: null, ...valid },
    // Shop vouchers
    { code: 'BALI10', title: '10% off at Bali Fresh Farm', type: 'PERCENT', value: 10, maxDiscount: 20000, minSpend: 50000, shopSlug: 'bali-fresh-farm', usageLimit: null, ...valid },
    { code: 'TANI5K', title: 'Rp5.000 off at Tani Makmur', type: 'FIXED', value: 5000, maxDiscount: null, minSpend: 30000, shopSlug: 'tani-makmur', usageLimit: null, ...valid },
    { code: 'JAVA25', title: '25% off at Java Harvest', type: 'PERCENT', value: 25, maxDiscount: 50000, minSpend: 100000, shopSlug: 'java-harvest', usageLimit: 100, ...valid },
    { code: 'SHOPFREE', title: 'Free shipping at Shop\'s Name', type: 'FREE_SHIPPING', value: 12000, maxDiscount: null, minSpend: 40000, shopSlug: 'shops-name', usageLimit: null, ...valid },
    // Edge cases for testing the error paths
    { code: 'EXPIRED10', title: 'Expired 10% voucher', type: 'PERCENT', value: 10, maxDiscount: null, minSpend: 0, shopSlug: null, startsAt: ago(60), endsAt: ago(1), usageLimit: null, usedCount: 0, isActive: true },
    { code: 'SOON25', title: 'Starts tomorrow', type: 'PERCENT', value: 25, maxDiscount: 40000, minSpend: 0, shopSlug: null, startsAt: ahead(1), endsAt: ahead(30), usageLimit: null, usedCount: 0, isActive: true },
    { code: 'USEDUP50', title: 'Fully used voucher', type: 'FIXED', value: 50000, maxDiscount: null, minSpend: 0, shopSlug: null, startsAt: ago(7), endsAt: ahead(60), usageLimit: 10, usedCount: 10, isActive: true },
    { code: 'PAUSED5K', title: 'Switched off voucher', type: 'FIXED', value: 5000, maxDiscount: null, minSpend: 0, shopSlug: null, startsAt: ago(7), endsAt: ahead(60), usageLimit: null, usedCount: 0, isActive: false },
  ];
}

// ---------- Seeding (safe to run many times) ----------

export async function seedShippingOptions(prisma: PrismaClient): Promise<number> {
  for (const option of shippingOptions) {
    const channel = await prisma.shippingChannel.findUniqueOrThrow({
      where: { name: option.channel },
      select: { id: true },
    });
    const fields = {
      price: option.price,
      minDays: option.minDays,
      maxDays: option.maxDays,
      isActive: option.isActive,
    };
    await prisma.shippingOption.upsert({
      // The channel and name identify the option, so they are not in the update.
      where: { channelId_name: { channelId: channel.id, name: option.name } },
      create: { channelId: channel.id, name: option.name, ...fields },
      update: fields,
    });
  }
  return shippingOptions.length;
}

export async function seedPaymentMethods(prisma: PrismaClient): Promise<number> {
  for (const method of paymentMethods) {
    const { code, ...fields } = method;
    await prisma.paymentMethod.upsert({ where: { code }, create: method, update: fields });
  }
  return paymentMethods.length;
}

// Needs the seeded shops. A shop that is missing is an error, so bad seed data is noticed.
export async function seedVouchers(prisma: PrismaClient, now: Date = new Date()): Promise<number> {
  const vouchers = buildVouchers(now);

  for (const voucher of vouchers) {
    const { shopSlug, code, usedCount, ...fields } = voucher;
    let shopId: number | null = null;
    if (shopSlug !== null) {
      shopId = (await prisma.shop.findUniqueOrThrow({ where: { slug: shopSlug }, select: { id: true } })).id;
    }
    await prisma.voucher.upsert({
      where: { code },
      // usedCount is only set when the voucher is created, so a re-run keeps real usage.
      create: { code, usedCount, shopId, ...fields },
      update: { shopId, ...fields },
    });
  }
  return vouchers.length;
}
