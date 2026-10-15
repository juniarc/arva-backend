import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  createCartRow,
  createWishlistRow,
  registerAndLogin,
  resetDatabase,
  seedFixtures,
  type Fixtures,
} from '../helpers/db.js';

// Fixture products: bali-banana-fruit (in stock, discounted), mango (stock 0), cucumber, sprayer,
// and hidden (inactive).
let app: ReturnType<typeof createApp>;
let fixtures: Fixtures;
let token: string;
let bobToken: string;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  // A fresh app gives fresh rate-limit counters.
  app = createApp();
  token = await registerAndLogin(app, 'alice');
  bobToken = await registerAndLogin(app, 'bob');
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function productId(slug: string): number {
  return fixtures.productIds[slug] ?? 0;
}

function getWishlist(authToken: string) {
  return request(app).get('/api/wishlist').set('Authorization', `Bearer ${authToken}`);
}

function addItem(authToken: string, body: unknown) {
  return request(app)
    .post('/api/wishlist')
    .set('Authorization', `Bearer ${authToken}`)
    .send(body as object);
}

// supertest sets Content-Type: application/json when the body is an object.
function removeItems(authToken: string, body?: unknown) {
  const req = request(app).delete('/api/wishlist/items').set('Authorization', `Bearer ${authToken}`);
  return body === undefined ? req : req.send(body as object);
}

function slugs(body: { items: { product: { slug: string } }[] }): string[] {
  return body.items.map((item) => item.product.slug);
}

describe('GET /api/wishlist', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/wishlist');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
  });

  it('returns an empty wishlist for a new user', async () => {
    const res = await getWishlist(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], itemCount: 0 });
  });

  it('returns the items newest first, with the product shape', async () => {
    await createWishlistRow('alice', productId('cucumber'), new Date('2026-01-01T00:00:00Z'));
    await createWishlistRow('alice', productId('bali-banana-fruit'), new Date('2026-01-03T00:00:00Z'));
    await createWishlistRow('alice', productId('sprayer'), new Date('2026-01-02T00:00:00Z'));

    const res = await getWishlist(token);

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'sprayer', 'cucumber']);
    expect(res.body.itemCount).toBe(3);
    expect(res.body.items[0]).toEqual({
      id: expect.any(String),
      addedAt: '2026-01-03T00:00:00.000Z',
      product: {
        id: String(productId('bali-banana-fruit')),
        slug: 'bali-banana-fruit',
        name: 'bali-banana-fruit',
        categorySlug: 'fruits',
        categoryName: 'Fruits',
        price: 1000,
        originalPrice: 1250,
        discountPercent: 20,
        rating: 3.4,
        soldCount: 500,
        city: 'Jakarta',
        imageUrl: '/images/dummy/bali-banana-fruit.jpg',
        shop: { slug: 'shops-name', name: "Shop's Name" },
        isAvailable: true,
      },
    });
  });

  it('breaks addedAt ties by id descending', async () => {
    const sameTime = new Date('2026-01-01T00:00:00Z');
    await createWishlistRow('alice', productId('cucumber'), sameTime);
    await createWishlistRow('alice', productId('sprayer'), sameTime);

    const res = await getWishlist(token);

    expect(slugs(res.body)).toEqual(['sprayer', 'cucumber']);
  });

  it('leaves out items of inactive products, but keeps the rows', async () => {
    await createWishlistRow('alice', productId('cucumber'));
    await createWishlistRow('alice', productId('hidden'));

    const res = await getWishlist(token);

    expect(slugs(res.body)).toEqual(['cucumber']);
    expect(res.body.itemCount).toBe(1);
    expect(await prisma.wishlistItem.count()).toBe(2);
  });

  it('shows isAvailable false for a product with no stock', async () => {
    await createWishlistRow('alice', productId('mango'));

    const res = await getWishlist(token);

    expect(res.body.items[0].product.isAvailable).toBe(false);
  });

  it('does not return other users\' items or any user data', async () => {
    await createWishlistRow('alice', productId('cucumber'));
    await createWishlistRow('bob', productId('sprayer'));

    const res = await getWishlist(token);

    expect(slugs(res.body)).toEqual(['cucumber']);
    expect(JSON.stringify(res.body)).not.toMatch(/userId|alice|bob|email/);
  });
});

describe('POST /api/wishlist', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/wishlist')
      .send({ productId: String(productId('cucumber')) });

    expect(res.status).toBe(401);
  });

  it('adds a product and returns the full list', async () => {
    await createWishlistRow('alice', productId('cucumber'));

    const res = await addItem(token, { productId: String(productId('sprayer')) });

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['sprayer', 'cucumber']);
    expect(res.body.itemCount).toBe(2);
  });

  it('is idempotent: adding the same product twice returns 200 and keeps one row', async () => {
    const body = { productId: String(productId('cucumber')) };

    const first = await addItem(token, body);
    const second = await addItem(token, body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await prisma.wishlistItem.count()).toBe(1);
  });

  it('creates one row when two parallel requests add the same product', async () => {
    const body = { productId: String(productId('cucumber')) };

    const [first, second] = await Promise.all([addItem(token, body), addItem(token, body)]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await prisma.wishlistItem.count()).toBe(1);
  });

  it('returns 404 for an unknown product', async () => {
    const res = await addItem(token, { productId: '999999' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Product not found.' });
  });

  it('returns 404 for an inactive product', async () => {
    const res = await addItem(token, { productId: String(productId('hidden')) });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Product not found.' });
    expect(await prisma.wishlistItem.count()).toBe(0);
  });

  it('accepts a zero-stock product and shows isAvailable false', async () => {
    const res = await addItem(token, { productId: String(productId('mango')) });

    expect(res.status).toBe(200);
    expect(res.body.items[0].product).toMatchObject({ slug: 'mango', isAvailable: false });
  });

  it('returns 400 with errors.productId for a missing, non-numeric or numeric productId', async () => {
    for (const body of [{}, { productId: 'abc' }, { productId: 12 }]) {
      const res = await addItem(token, body);
      expect(res.status).toBe(400);
      expect(res.body.errors.productId).toEqual(expect.any(String));
    }
  });

  it('returns 400 for an unknown field in the body', async () => {
    const res = await addItem(token, { productId: String(productId('cucumber')), userId: 999 });

    expect(res.status).toBe(400);
    expect(res.body.errors.userId).toEqual(expect.any(String));
  });

  it('does not change the cart', async () => {
    await createCartRow('alice', fixtures.variantIds['cucumber/1 kg'] ?? 0, 2);
    const before = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

    await addItem(token, { productId: String(productId('cucumber')) }).expect(200);

    const after = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(after.body).toEqual(before.body);
    expect(await prisma.cartItem.count()).toBe(1);
  });
});

describe('DELETE /api/wishlist/items', () => {
  it('returns 401 without a token', async () => {
    const itemId = await createWishlistRow('alice', productId('cucumber'));

    const res = await request(app)
      .delete('/api/wishlist/items')
      .send({ itemIds: [String(itemId)] });

    expect(res.status).toBe(401);
    expect(await prisma.wishlistItem.count()).toBe(1);
  });

  it("removes two of the user's items and returns the remaining list", async () => {
    const first = await createWishlistRow('alice', productId('cucumber'));
    const second = await createWishlistRow('alice', productId('sprayer'));
    await createWishlistRow('alice', productId('mango'));

    const res = await removeItems(token, { itemIds: [String(first), String(second)] });

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['mango']);
    expect(res.body.itemCount).toBe(1);
    expect(await prisma.wishlistItem.count({ where: { id: { in: [first, second] } } })).toBe(0);
  });

  it("ignores another user's item id and returns 200", async () => {
    await createWishlistRow('alice', productId('cucumber'));
    const bobItem = await createWishlistRow('bob', productId('cucumber'));

    const res = await removeItems(token, { itemIds: [String(bobItem)] });

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['cucumber']);
    expect(await prisma.wishlistItem.findUnique({ where: { id: bobItem } })).not.toBeNull();
  });

  it('returns 200 for an id that does not exist', async () => {
    await createWishlistRow('alice', productId('cucumber'));

    const res = await removeItems(token, { itemIds: ['999999'] });

    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(1);
  });

  it('removes an item once when its id is sent several times', async () => {
    const itemId = await createWishlistRow('alice', productId('cucumber'));
    await createWishlistRow('alice', productId('sprayer'));

    const res = await removeItems(token, { itemIds: [String(itemId), String(itemId)] });

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['sprayer']);
  });

  it('returns 400 for an empty itemIds array', async () => {
    const res = await removeItems(token, { itemIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.errors.itemIds).toEqual(expect.any(String));
  });

  it('returns 400 for more than 100 ids', async () => {
    const itemIds = Array.from({ length: 101 }, (_, index) => String(index + 1));

    const res = await removeItems(token, { itemIds });

    expect(res.status).toBe(400);
    expect(res.body.errors.itemIds).toEqual(expect.any(String));
  });

  it('returns 400 with errors.itemIds for a non-numeric id', async () => {
    const res = await removeItems(token, { itemIds: ['12', 'abc'] });

    expect(res.status).toBe(400);
    expect(res.body.errors.itemIds).toEqual(expect.any(String));
  });

  it('removes items when the body is sent as application/json', async () => {
    const itemId = await createWishlistRow('alice', productId('cucumber'));

    const res = await request(app)
      .delete('/api/wishlist/items')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ itemIds: [String(itemId)] }));

    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(0);
    expect(await prisma.wishlistItem.count()).toBe(0);
  });

  it('returns 400 when there is no body', async () => {
    const itemId = await createWishlistRow('alice', productId('cucumber'));

    const res = await removeItems(token);

    expect(res.status).toBe(400);
    expect(res.body.errors.itemIds).toEqual(expect.any(String));
    expect(await prisma.wishlistItem.findUnique({ where: { id: itemId } })).not.toBeNull();
  });

  it('returns 400 for an unknown field in the body', async () => {
    const res = await removeItems(token, { itemIds: ['1'], userId: 2 });

    expect(res.status).toBe(400);
    expect(res.body.errors.userId).toEqual(expect.any(String));
  });

  it("leaves the other user's wishlist unchanged", async () => {
    const aliceItem = await createWishlistRow('alice', productId('cucumber'));
    await createWishlistRow('bob', productId('sprayer'));
    const before = await getWishlist(bobToken);

    await removeItems(token, { itemIds: [String(aliceItem)] }).expect(200);

    const after = await getWishlist(bobToken);
    expect(after.body).toEqual(before.body);
    expect(after.body.itemCount).toBe(1);
  });
});
