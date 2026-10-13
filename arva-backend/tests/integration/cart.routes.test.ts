import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { createCartRow, registerAndLogin, resetDatabase, seedFixtures, type Fixtures } from '../helpers/db.js';

let app: ReturnType<typeof createApp>;
let fixtures: Fixtures;
let token: string;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  // A fresh app gives fresh rate-limit counters.
  app = createApp();
  token = await registerAndLogin(app, 'alice');
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function variantId(key: string): string {
  return String(fixtures.variantIds[key]);
}

function addToCart(authToken: string, body: unknown) {
  return request(app).post('/api/cart').set('Authorization', `Bearer ${authToken}`).send(body as object);
}

describe('GET /api/cart', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/cart');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
  });

  it('returns an empty cart for a new user', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], itemCount: 0, subtotal: 0 });
  });

  it('returns product.shop for each item, and shopName still equals shop.name', async () => {
    await addToCart(token, { variantId: variantId('sprayer/2 L'), quantity: 1 }).expect(200);
    await addToCart(token, { variantId: variantId('cucumber/1 kg'), quantity: 1 }).expect(200);

    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

    const shops = res.body.items.map((i: { product: { shop: unknown } }) => i.product.shop);
    expect(shops).toEqual([
      { slug: 'shop-b', name: 'Shop B' },
      { slug: 'shops-name', name: "Shop's Name" },
    ]);
    for (const item of res.body.items as { product: { shopName: string; shop: { name: string } } }[]) {
      expect(item.product.shopName).toBe(item.product.shop.name);
    }
  });

  it('orders items by shop name, product name, then variant position', async () => {
    // Added in a scrambled order. The mango variant has no stock, so it is inserted directly.
    await addToCart(token, { variantId: variantId('cucumber/1 kg'), quantity: 1 }).expect(200);
    await addToCart(token, { variantId: variantId('bali-banana-fruit/2 kg'), quantity: 1 }).expect(200);
    await addToCart(token, { variantId: variantId('sprayer/2 L'), quantity: 1 }).expect(200);
    await addToCart(token, { variantId: variantId('bali-banana-fruit/1 kg'), quantity: 1 }).expect(200);
    await createCartRow('alice', fixtures.variantIds['mango/1 kg'] ?? 0, 1);

    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

    expect(res.body.items.map((i: { product: { slug: string }; variant: { label: string } }) => `${i.product.slug}/${i.variant.label}`)).toEqual([
      'mango/1 kg',
      'sprayer/2 L',
      'bali-banana-fruit/1 kg',
      'bali-banana-fruit/2 kg',
      'cucumber/1 kg',
    ]);
  });

  it('leaves out items of inactive products from the items and totals, but keeps the rows', async () => {
    await addToCart(token, { variantId: variantId('cucumber/1 kg'), quantity: 2 }).expect(200);
    await createCartRow('alice', fixtures.variantIds['hidden/1 kg'] ?? 0, 3);

    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.itemCount).toBe(2);
    expect(res.body.subtotal).toBe(1000);
    expect(await prisma.cartItem.count()).toBe(2);
  });
});

describe('POST /api/cart', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/cart').send({ variantId: variantId('bali-banana-fruit/1 kg'), quantity: 1 });

    expect(res.status).toBe(401);
  });

  it('adds a variant and returns the full cart with the correct subtotal', async () => {
    const res = await addToCart(token, { variantId: variantId('bali-banana-fruit/1 kg'), quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        {
          id: expect.any(String),
          quantity: 2,
          product: {
            id: expect.any(String),
            slug: 'bali-banana-fruit',
            name: 'bali-banana-fruit',
            imageUrl: '/images/dummy/bali-banana-fruit.jpg',
            shopName: "Shop's Name",
            shop: { slug: 'shops-name', name: "Shop's Name" },
          },
          variant: { id: variantId('bali-banana-fruit/1 kg'), label: '1 kg', unit: 'kg', price: 1000, stock: 10 },
        },
      ],
      itemCount: 2,
      subtotal: 2000,
    });

    // GET returns the same cart.
    const get = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(get.body).toEqual(res.body);
  });

  it('increases the quantity when the same variant is added twice', async () => {
    await addToCart(token, { variantId: variantId('bali-banana-fruit/1 kg'), quantity: 2 }).expect(200);
    const res = await addToCart(token, { variantId: variantId('bali-banana-fruit/1 kg'), quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(5);
    expect(res.body.itemCount).toBe(5);
    expect(res.body.subtotal).toBe(5000);
  });

  it('sums several variants in the subtotal', async () => {
    await addToCart(token, { variantId: variantId('bali-banana-fruit/1 kg'), quantity: 2 }).expect(200);
    const res = await addToCart(token, { variantId: variantId('cucumber/1 kg'), quantity: 4 });

    expect(res.body.itemCount).toBe(6);
    expect(res.body.subtotal).toBe(2 * 1000 + 4 * 500);
  });

  it('returns 409 INSUFFICIENT_STOCK when the quantity is above stock', async () => {
    const res = await addToCart(token, { variantId: variantId('sprayer/2 L'), quantity: 4 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Only 3 left in stock.', code: 'INSUFFICIENT_STOCK' });
  });

  it('counts what is already in the cart when checking stock', async () => {
    await addToCart(token, { variantId: variantId('sprayer/2 L'), quantity: 2 }).expect(200);
    const res = await addToCart(token, { variantId: variantId('sprayer/2 L'), quantity: 2 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Only 1 left in stock.', code: 'INSUFFICIENT_STOCK' });
  });

  it('returns 409 OUT_OF_STOCK for a zero-stock variant', async () => {
    const res = await addToCart(token, { variantId: variantId('mango/1 kg'), quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'This variant is out of stock.', code: 'OUT_OF_STOCK' });
  });

  it('returns 404 for an unknown variant and for a variant of an inactive product', async () => {
    const unknown = await addToCart(token, { variantId: '999999', quantity: 1 });
    const inactive = await addToCart(token, { variantId: variantId('hidden/1 kg'), quantity: 1 });

    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ message: 'Product not found.' });
    expect(inactive.status).toBe(404);
  });

  it('returns 400 for quantity 0 and 100', async () => {
    const zero = await addToCart(token, { variantId: variantId('bali-banana-fruit/1 kg'), quantity: 0 });
    const hundred = await addToCart(token, { variantId: variantId('bali-banana-fruit/1 kg'), quantity: 100 });

    expect(zero.status).toBe(400);
    expect(zero.body.errors.quantity).toEqual(expect.any(String));
    expect(hundred.status).toBe(400);
    expect(hundred.body.errors.quantity).toEqual(expect.any(String));
  });

  it('returns 400 for a bad variantId, a missing field and unknown keys', async () => {
    const badId = await addToCart(token, { variantId: 'abc', quantity: 1 });
    const missing = await addToCart(token, {});
    const extra = await addToCart(token, {
      variantId: variantId('bali-banana-fruit/1 kg'),
      quantity: 1,
      userId: 999,
    });

    expect(badId.body.errors.variantId).toEqual(expect.any(String));
    expect(Object.keys(missing.body.errors).sort()).toEqual(['quantity', 'variantId']);
    expect(extra.status).toBe(400);
    expect(extra.body.errors.userId).toEqual(expect.any(String));
  });

  it('keeps each user\'s cart separate', async () => {
    const bobToken = await registerAndLogin(app, 'bob');
    await addToCart(token, { variantId: variantId('bali-banana-fruit/1 kg'), quantity: 1 }).expect(200);
    await addToCart(bobToken, { variantId: variantId('cucumber/1 kg'), quantity: 2 }).expect(200);

    const alice = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    const bob = await request(app).get('/api/cart').set('Authorization', `Bearer ${bobToken}`);

    expect(alice.body.items.map((i: { product: { slug: string } }) => i.product.slug)).toEqual(['bali-banana-fruit']);
    expect(bob.body.items.map((i: { product: { slug: string } }) => i.product.slug)).toEqual(['cucumber']);
  });

  it('lets only one of two parallel adds take the last units', async () => {
    // Stock is 3. Each request wants 2, so only one fits.
    const body = { variantId: variantId('sprayer/2 L'), quantity: 2 };

    const [first, second] = await Promise.all([addToCart(token, body), addToCart(token, body)]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const get = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(get.body.itemCount).toBe(2);
  });
});
