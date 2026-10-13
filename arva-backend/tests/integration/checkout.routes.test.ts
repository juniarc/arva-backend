import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  createCartRow,
  regionId,
  registerAndLogin,
  resetDatabase,
  seedFixtures,
  seedTestRegions,
  type Fixtures,
} from '../helpers/db.js';

// Fixture variants: banana "1 kg" 1000 (stock 10), cucumber "1 kg" 500 (stock 20),
// sprayer "2 L" 3000 (stock 3), mango "1 kg" (stock 0), hidden "1 kg" (inactive).
let app: ReturnType<typeof createApp>;
let fixtures: Fixtures;
let token: string;
let bobToken: string;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  await seedTestRegions();
  // A fresh app gives fresh rate-limit counters.
  app = createApp();
  token = await registerAndLogin(app, 'alice');
  bobToken = await registerAndLogin(app, 'bob');
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function variantId(key: string): number {
  return fixtures.variantIds[key] ?? 0;
}

function auth(authToken: string) {
  return { Authorization: `Bearer ${authToken}` };
}

function createDraft(authToken: string, body: unknown) {
  return request(app).post('/api/checkout').set(auth(authToken)).send(body as object);
}

function getDraft(authToken: string) {
  return request(app).get('/api/checkout').set(auth(authToken));
}

function putAddress(authToken: string, body: unknown) {
  return request(app).put('/api/checkout/address').set(auth(authToken)).send(body as object);
}

// Creates cart rows for alice and returns their ids.
async function aliceCart(): Promise<{ banana: number; cucumber: number }> {
  return {
    banana: await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 3),
    cucumber: await createCartRow('alice', variantId('cucumber/1 kg'), 2),
  };
}

async function validAddress() {
  return {
    label: 'Home',
    province: { id: String(await regionId('province', 'DKI Jakarta')) },
    city: { id: String(await regionId('city', 'Jakarta Selatan')) },
    district: { id: String(await regionId('district', 'Kebayoran Baru')) },
    subDistrict: { id: String(await regionId('subDistrict', 'Gunung')) },
    street: 'Jl. Mawar No. 1',
    recipientName: 'Alice',
    phone: '081234567890',
  };
}

describe('POST /api/checkout', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/checkout').send({ itemIds: ['1'] });

    expect(res.status).toBe(401);
  });

  it('creates a draft from two cart items with the right subtotal and shape', async () => {
    const cart = await aliceCart();

    const res = await createDraft(token, { itemIds: [String(cart.cucumber), String(cart.banana)] });

    expect(res.status).toBe(200);
    // Same order as the cart: product name within a shop.
    expect(res.body).toEqual({
      items: [
        {
          id: expect.any(String),
          quantity: 3,
          product: {
            id: String(fixtures.productIds['bali-banana-fruit']),
            slug: 'bali-banana-fruit',
            name: 'bali-banana-fruit',
            imageUrl: '/images/dummy/bali-banana-fruit.jpg',
            shop: { slug: 'shops-name', name: "Shop's Name" },
          },
          variant: { id: String(variantId('bali-banana-fruit/1 kg')), label: '1 kg', unit: 'kg', price: 1000, stock: 10 },
        },
        {
          id: expect.any(String),
          quantity: 2,
          product: {
            id: String(fixtures.productIds['cucumber']),
            slug: 'cucumber',
            name: 'cucumber',
            imageUrl: '/images/dummy/cucumber.jpg',
            shop: { slug: 'shops-name', name: "Shop's Name" },
          },
          variant: { id: String(variantId('cucumber/1 kg')), label: '1 kg', unit: 'kg', price: 500, stock: 20 },
        },
      ],
      unavailableItemCount: 0,
      address: null,
      damageProtection: { enabled: false, fee: 0 },
      shipping: null,
      voucher: null,
      paymentMethod: null,
      summary: {
        productSubtotal: 3 * 1000 + 2 * 500,
        shippingSubtotal: 0,
        buyerServiceFee: 0,
        handlingFee: 0,
        damageProtectionFee: 0,
        discount: 0,
        total: 4000,
      },
    });
  });

  it('only drafts the selected items', async () => {
    const cart = await aliceCart();

    const res = await createDraft(token, { itemIds: [String(cart.cucumber)] });

    expect(res.body.items).toHaveLength(1);
    expect(res.body.summary.productSubtotal).toBe(1000);
  });

  it('replaces the previous draft: one draft per user, with only the new items and no address', async () => {
    const cart = await aliceCart();
    await createDraft(token, { itemIds: [String(cart.banana)] }).expect(200);
    await putAddress(token, await validAddress()).expect(200);

    const res = await createDraft(token, { itemIds: [String(cart.cucumber)] });

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { product: { slug: string } }) => item.product.slug)).toEqual(['cucumber']);
    expect(res.body.address).toBeNull();
    expect(await prisma.checkoutDraft.count()).toBe(1);
    expect(await prisma.checkoutDraftItem.count()).toBe(1);
  });

  it('removes duplicate ids', async () => {
    const cart = await aliceCart();

    const res = await createDraft(token, { itemIds: [String(cart.banana), String(cart.banana)] });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('returns 400 for an empty itemIds array', async () => {
    const res = await createDraft(token, { itemIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.errors.itemIds).toEqual(expect.any(String));
  });

  it('returns 400 for a non-numeric id, more than 100 ids, a missing field and an unknown field', async () => {
    const tooMany = Array.from({ length: 101 }, (_, index) => String(index + 1));

    for (const body of [{ itemIds: ['abc'] }, { itemIds: tooMany }, {}, { itemIds: ['1'], userId: 2 }]) {
      const res = await createDraft(token, body);
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    }
  });

  it("returns 400 for another user's cart item, the same as for an unknown id", async () => {
    const bobItem = await createCartRow('bob', variantId('cucumber/1 kg'), 1);

    const other = await createDraft(token, { itemIds: [String(bobItem)] });
    const unknown = await createDraft(token, { itemIds: ['999999'] });

    expect(other.status).toBe(400);
    expect(other.body.message).toBe('Some items are no longer in your cart.');
    expect(other.body.errors.itemIds).toEqual(expect.any(String));
    expect(other.body).toEqual(unknown.body);
    expect(await prisma.checkoutDraft.count()).toBe(0);
  });

  it('returns 409 OUT_OF_STOCK for a zero-stock product', async () => {
    const mango = await createCartRow('alice', variantId('mango/1 kg'), 1);

    const res = await createDraft(token, { itemIds: [String(mango)] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'mango is out of stock.', code: 'OUT_OF_STOCK' });
  });

  it('returns 409 INSUFFICIENT_STOCK when the quantity is above the stock', async () => {
    const sprayer = await createCartRow('alice', variantId('sprayer/2 L'), 5);

    const res = await createDraft(token, { itemIds: [String(sprayer)] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Only 3 left in stock.', code: 'INSUFFICIENT_STOCK' });
  });

  it('accepts a quantity equal to the stock', async () => {
    const sprayer = await createCartRow('alice', variantId('sprayer/2 L'), 3);

    const res = await createDraft(token, { itemIds: [String(sprayer)] });

    expect(res.status).toBe(200);
  });

  it('returns 409 PRODUCT_UNAVAILABLE for an inactive product', async () => {
    const hidden = await createCartRow('alice', variantId('hidden/1 kg'), 1);

    const res = await createDraft(token, { itemIds: [String(hidden)] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'One of the products is no longer available.', code: 'PRODUCT_UNAVAILABLE' });
  });

  it('keeps the previous draft when a new one is rejected', async () => {
    const cart = await aliceCart();
    await createDraft(token, { itemIds: [String(cart.banana)] }).expect(200);
    const mango = await createCartRow('alice', variantId('mango/1 kg'), 1);

    await createDraft(token, { itemIds: [String(mango)] }).expect(409);

    const draft = await getDraft(token);
    expect(draft.body.items.map((item: { product: { slug: string } }) => item.product.slug)).toEqual([
      'bali-banana-fruit',
    ]);
  });

  it('returns 429 after 30 requests per minute for one user', async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) {
      last = (await createDraft(token, { itemIds: [] })).status;
    }

    expect(last).toBe(429);
  });
});

describe('GET /api/checkout', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/checkout');

    expect(res.status).toBe(401);
  });

  it('returns 404 when there is no draft', async () => {
    const res = await getDraft(token);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Checkout session not found.' });
  });

  it('returns only the current user\'s draft', async () => {
    const cart = await aliceCart();
    await createDraft(token, { itemIds: [String(cart.banana)] }).expect(200);

    const bob = await getDraft(bobToken);

    expect(bob.status).toBe(404);
  });

  it('drops a draft item when its cart item is removed from the cart', async () => {
    const cart = await aliceCart();
    await createDraft(token, { itemIds: [String(cart.banana), String(cart.cucumber)] }).expect(200);

    await request(app)
      .delete('/api/cart/items')
      .set(auth(token))
      .send({ itemIds: [String(cart.banana)] })
      .expect(200);

    const res = await getDraft(token);
    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { product: { slug: string } }) => item.product.slug)).toEqual(['cucumber']);
    expect(res.body.summary.productSubtotal).toBe(1000);
  });

  it('shows the current cart quantity in the product subtotal', async () => {
    const cart = await aliceCart();
    await createDraft(token, { itemIds: [String(cart.banana)] }).expect(200);

    await request(app)
      .patch(`/api/cart/items/${cart.banana}`)
      .set(auth(token))
      .send({ quantity: 5 })
      .expect(200);

    const res = await getDraft(token);
    expect(res.body.items[0].quantity).toBe(5);
    expect(res.body.summary.productSubtotal).toBe(5000);
    expect(res.body.summary.total).toBe(5000);
  });

  it('leaves out items whose product became inactive and counts them', async () => {
    const cart = await aliceCart();
    await createDraft(token, { itemIds: [String(cart.banana), String(cart.cucumber)] }).expect(200);
    await prisma.product.update({ where: { id: fixtures.productIds['cucumber'] }, data: { isActive: false } });

    const res = await getDraft(token);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.unavailableItemCount).toBe(1);
    expect(res.body.summary.productSubtotal).toBe(3000);
  });

  it('does not expose internal fields', async () => {
    const cart = await aliceCart();
    await createDraft(token, { itemIds: [String(cart.banana)] }).expect(200);

    const res = await getDraft(token);

    expect(JSON.stringify(res.body)).not.toMatch(/userId|draftId|createdAt|updatedAt|isActive/);
  });
});

describe('PUT /api/checkout/address', () => {
  async function draftForAlice(): Promise<void> {
    const cart = await aliceCart();
    await createDraft(token, { itemIds: [String(cart.banana)] }).expect(200);
  }

  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/checkout/address').send(await validAddress());

    expect(res.status).toBe(401);
  });

  it('sets the address and returns the full draft', async () => {
    await draftForAlice();

    const res = await putAddress(token, { ...(await validAddress()), label: '  Home  ' });

    expect(res.status).toBe(200);
    expect(res.body.address).toEqual({
      label: 'Home',
      street: 'Jl. Mawar No. 1',
      recipientName: 'Alice',
      phone: '081234567890',
      province: { id: expect.any(String), name: 'DKI Jakarta' },
      city: { id: expect.any(String), name: 'Jakarta Selatan' },
      district: { id: expect.any(String), name: 'Kebayoran Baru' },
      subDistrict: { id: expect.any(String), name: 'Gunung' },
    });
    expect(res.body.items).toHaveLength(1);
    expect((await getDraft(token)).body.address).toEqual(res.body.address);
  });

  it('replaces the whole address', async () => {
    await draftForAlice();
    await putAddress(token, await validAddress()).expect(200);

    const res = await putAddress(token, {
      label: 'Office',
      province: { id: String(await regionId('province', 'Bali')) },
      city: { id: String(await regionId('city', 'Kota Denpasar')) },
      district: { id: String(await regionId('district', 'Denpasar Selatan')) },
      subDistrict: { id: String(await regionId('subDistrict', 'Sanur')) },
      street: 'Jl. Pantai 9',
      recipientName: 'Alice W',
      phone: '08987654321',
    });

    expect(res.status).toBe(200);
    expect(res.body.address).toMatchObject({ label: 'Office', phone: '08987654321', city: { name: 'Kota Denpasar' } });
  });

  it('returns 400 with errors.city for a city from another province', async () => {
    await draftForAlice();

    const res = await putAddress(token, {
      ...(await validAddress()),
      city: { id: String(await regionId('city', 'Kota Bandung')) },
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.city).toBe('This city is not in the selected province.');
    expect((await getDraft(token)).body.address).toBeNull();
  });

  it('returns 400 for a district from another city and a sub-district from another district', async () => {
    await draftForAlice();
    const base = await validAddress();

    const district = await putAddress(token, { ...base, district: { id: String(await regionId('district', 'Cicendo')) } });
    const subDistrict = await putAddress(token, {
      ...base,
      subDistrict: { id: String(await regionId('subDistrict', 'Sanur')) },
    });

    expect(district.body.errors.district).toBe('This district is not in the selected city.');
    expect(subDistrict.body.errors.subDistrict).toBe('This sub-district is not in the selected district.');
  });

  it('returns 400 for a region id that does not exist', async () => {
    await draftForAlice();

    const res = await putAddress(token, { ...(await validAddress()), province: { id: '99999' } });

    expect(res.status).toBe(400);
    expect(res.body.errors.province).toBe('Province not found.');
  });

  it.each(['0812abc4567', '0812 3456 7890', '+6281234567890', '1234567'])(
    'returns 400 with errors.phone for the phone "%s"',
    async (phone) => {
      await draftForAlice();

      const res = await putAddress(token, { ...(await validAddress()), phone });

      expect(res.status).toBe(400);
      expect(res.body.errors.phone).toEqual(expect.any(String));
    },
  );

  it('returns 400 for a partial body and saves nothing', async () => {
    await draftForAlice();
    const { street, phone, ...partial } = await validAddress();
    expect([street, phone]).toHaveLength(2);

    const res = await putAddress(token, partial);

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['phone', 'street']);
    expect((await getDraft(token)).body.address).toBeNull();
  });

  it('returns 400 for an unknown field', async () => {
    await draftForAlice();

    const res = await putAddress(token, { ...(await validAddress()), userId: 2 });

    expect(res.status).toBe(400);
    expect(res.body.errors.userId).toEqual(expect.any(String));
  });

  it('returns 404 when the user has no draft', async () => {
    const res = await putAddress(token, await validAddress());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Checkout session not found.' });
  });

  it("does not change another user's draft or any user data", async () => {
    await draftForAlice();
    const bobItem = await createCartRow('bob', variantId('cucumber/1 kg'), 1);
    await createDraft(bobToken, { itemIds: [String(bobItem)] }).expect(200);
    const usersBefore = await prisma.user.findMany({ orderBy: { id: 'asc' } });

    await putAddress(token, await validAddress()).expect(200);

    expect((await getDraft(bobToken)).body.address).toBeNull();
    expect(await prisma.user.findMany({ orderBy: { id: 'asc' } })).toEqual(usersBefore);
  });

  it('returns address null when a stored address is only partly filled', async () => {
    await draftForAlice();
    await prisma.checkoutDraft.updateMany({ data: { addressLabel: 'Home', phone: '081234567890' } });

    const res = await getDraft(token);

    expect(res.body.address).toBeNull();
  });

  it('returns 429 after 30 requests per minute for one user', async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) {
      last = (await putAddress(token, {})).status;
    }

    expect(last).toBe(429);
  });
});
