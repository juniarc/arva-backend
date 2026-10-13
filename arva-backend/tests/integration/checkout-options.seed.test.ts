import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase, seedFixtures, seedTestChannels, seedTestCheckoutOptions } from '../helpers/db.js';

// The shop vouchers point at seeded shops. The fixture shops have other slugs, so the seeded
// shops those vouchers need are created here.
async function createVoucherShops(): Promise<void> {
  for (const slug of ['bali-fresh-farm', 'tani-makmur', 'java-harvest', 'shops-name']) {
    await prisma.shop.upsert({
      where: { slug },
      create: { slug, name: slug, city: 'Jakarta' },
      update: {},
    });
  }
}

beforeEach(async () => {
  await resetDatabase();
  await seedFixtures();
  await createVoucherShops();
  await seedTestChannels();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('the checkout test data seed', () => {
  it('loads shipping options, payment methods and vouchers', async () => {
    await seedTestCheckoutOptions();

    expect(await prisma.shippingOption.count()).toBe(6);
    expect(await prisma.paymentMethod.count()).toBe(4);
    expect(await prisma.voucher.count()).toBe(11);
  });

  it('can run twice without duplicating rows', async () => {
    await seedTestCheckoutOptions();
    await seedTestCheckoutOptions();

    expect(await prisma.shippingOption.count()).toBe(6);
    expect(await prisma.paymentMethod.count()).toBe(4);
    expect(await prisma.voucher.count()).toBe(11);
  });

  it('keeps real voucher usage when it runs again', async () => {
    await seedTestCheckoutOptions();
    await prisma.voucher.update({ where: { code: 'WELCOME15' }, data: { usedCount: 3 } });

    await seedTestCheckoutOptions();

    expect((await prisma.voucher.findUniqueOrThrow({ where: { code: 'WELCOME15' } })).usedCount).toBe(3);
  });

  it('links shop vouchers to their shop and platform vouchers to none', async () => {
    await seedTestCheckoutOptions();

    const bali = await prisma.voucher.findUniqueOrThrow({ where: { code: 'BALI10' }, include: { shop: true } });
    const welcome = await prisma.voucher.findUniqueOrThrow({ where: { code: 'WELCOME15' } });
    expect(bali.shop?.slug).toBe('bali-fresh-farm');
    expect(welcome.shopId).toBeNull();
  });

  it('does not create users, orders or drafts', async () => {
    await seedTestCheckoutOptions();

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.checkoutDraft.count()).toBe(0);
  });
});

describe('the database CHECK rules', () => {
  const base = {
    title: 'x',
    type: 'FIXED' as const,
    value: 1000,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: new Date('2026-02-01T00:00:00Z'),
  };

  it('reject a percent voucher above 100', async () => {
    await expect(prisma.voucher.create({ data: { ...base, code: 'BAD1', type: 'PERCENT', value: 101 } })).rejects.toThrow();
  });

  it('reject a voucher that ends before it starts', async () => {
    await expect(
      prisma.voucher.create({ data: { ...base, code: 'BAD2', endsAt: new Date('2025-12-01T00:00:00Z') } }),
    ).rejects.toThrow();
  });

  it('reject more uses than the limit, and a zero value', async () => {
    await expect(prisma.voucher.create({ data: { ...base, code: 'BAD3', usageLimit: 1, usedCount: 2 } })).rejects.toThrow();
    await expect(prisma.voucher.create({ data: { ...base, code: 'BAD4', value: 0 } })).rejects.toThrow();
  });

  it('reject a shipping option with a negative price or backwards days', async () => {
    const channel = await prisma.shippingChannel.findFirstOrThrow({ select: { id: true } });

    await expect(
      prisma.shippingOption.create({ data: { channelId: channel.id, name: 'Bad', price: -1, minDays: 1, maxDays: 2 } }),
    ).rejects.toThrow();
    await expect(
      prisma.shippingOption.create({ data: { channelId: channel.id, name: 'Bad2', price: 1, minDays: 5, maxDays: 2 } }),
    ).rejects.toThrow();
  });

  it('accept a valid voucher', async () => {
    await expect(prisma.voucher.create({ data: { ...base, code: 'GOOD' } })).resolves.toBeDefined();
  });
});
