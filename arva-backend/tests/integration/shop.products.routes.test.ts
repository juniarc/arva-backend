import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  createExtraProduct,
  createOwnedShop,
  registerAndLogin,
  resetDatabase,
  seedFixtures,
  seedTestChannels,
  seedTestRegions,
} from '../helpers/db.js';

// alice owns "alice-farm". Products, created in this order (so ids and createdAt rise):
//   af-apple: variants 1000 and 1500 (stock 10 each), sold 10, 5 ratings, active
//   af-pear:  variant 2000, sold 30, 2 ratings, active
//   af-fig:   variant 500, sold 30, 8 ratings, INACTIVE
//   af-kiwi:  variant 700, sold 30, 2 ratings, active
let app: ReturnType<typeof createApp>;
let aliceToken: string;
let bobToken: string;

beforeEach(async () => {
  await resetDatabase();
  await seedFixtures();
  await seedTestRegions();
  await seedTestChannels();
  // A fresh app gives fresh rate-limit counters.
  app = createApp();
  aliceToken = await registerAndLogin(app, 'alice');
  bobToken = await registerAndLogin(app, 'bob');
  const shopId = await createOwnedShop({ slug: 'alice-farm', name: 'Alice Farm', ownerUsername: 'alice' });
  await createExtraProduct({ slug: 'af-apple', shopId, prices: [1000, 1500], soldCount: 10, ratingCount: 5, ratingTenths: 40 });
  await createExtraProduct({ slug: 'af-pear', shopId, prices: [2000], soldCount: 30, ratingCount: 2 });
  await createExtraProduct({ slug: 'af-fig', shopId, prices: [500], soldCount: 30, ratingCount: 8, isActive: false });
  await createExtraProduct({ slug: 'af-kiwi', shopId, prices: [700], soldCount: 30, ratingCount: 2 });
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function getProducts(query = '', authToken?: string) {
  const req = request(app).get(`/api/shops/alice-farm/products${query}`);
  return authToken === undefined ? req : req.set('Authorization', `Bearer ${authToken}`);
}

function slugs(body: { products: { slug: string }[] }): string[] {
  return body.products.map((product) => product.slug);
}

describe('GET /api/shops/:slug/products as a guest or non-owner', () => {
  it('returns only active products, with manage null', async () => {
    const res = await getProducts();

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['af-kiwi', 'af-pear', 'af-apple']);
    expect(res.body.products.every((p: { manage: unknown }) => p.manage === null)).toBe(true);
    expect(res.body.pagination).toEqual({ page: 1, limit: 12, total: 3, totalPages: 1 });
  });

  it('treats another logged in user like a guest', async () => {
    const res = await getProducts('', bobToken);

    expect(slugs(res.body)).toEqual(['af-kiwi', 'af-pear', 'af-apple']);
    expect(res.body.products[0].manage).toBeNull();
  });

  it('treats an invalid token like a guest', async () => {
    const res = await request(app).get('/api/shops/alice-farm/products').set('Authorization', 'Bearer nope');

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(3);
  });

  it('returns the product shape with the lowest price and the shop', async () => {
    const res = await getProducts();
    const apple = res.body.products.find((p: { slug: string }) => p.slug === 'af-apple');

    expect(apple).toEqual({
      id: expect.any(String),
      slug: 'af-apple',
      name: 'af-apple',
      imageUrl: '/images/dummy/af-apple.jpg',
      categoryName: 'Fruits',
      price: 1000,
      originalPrice: null,
      discountPercent: null,
      rating: 4,
      soldCount: 10,
      city: 'Kota Administrasi Jakarta Selatan',
      shop: { slug: 'alice-farm', name: 'Alice Farm' },
      manage: null,
    });
  });

  it('does not expose owner or user fields', async () => {
    const res = await getProducts();

    expect(JSON.stringify(res.body)).not.toMatch(/ownerId|email|phone|userId|alice-farm@/);
  });
});

describe('GET /api/shops/:slug/products as the owner', () => {
  it('includes inactive products and fills manage', async () => {
    const res = await getProducts('', aliceToken);

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['af-kiwi', 'af-fig', 'af-pear', 'af-apple']);
    const apple = res.body.products.find((p: { slug: string }) => p.slug === 'af-apple');
    const fig = res.body.products.find((p: { slug: string }) => p.slug === 'af-fig');
    expect(apple.manage).toEqual({ isActive: true, totalStock: 20, variantLabels: ['v0', 'v1'], ratingCount: 5 });
    expect(fig.manage).toEqual({ isActive: false, totalStock: 10, variantLabels: ['v0'], ratingCount: 8 });
  });

  it('lists variant labels in position order even when the prices run the other way', async () => {
    const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: 'alice-farm' }, select: { id: true } });
    // Position 0 is the more expensive variant.
    const product = await prisma.product.create({
      data: {
        slug: 'af-melon',
        name: 'af-melon',
        categoryId: (await prisma.category.findFirstOrThrow({ select: { id: true } })).id,
        shopId: shop.id,
        imageUrl: '/x.jpg',
        variants: {
          create: [
            { label: 'Large', unit: 'kg', price: 9000, stock: 3, position: 0 },
            { label: 'Small', unit: 'kg', price: 4000, stock: 2, position: 1 },
          ],
        },
      },
      select: { slug: true },
    });

    const res = await getProducts('?limit=48', aliceToken);
    const melon = res.body.products.find((p: { slug: string }) => p.slug === product.slug);

    expect(melon.price).toBe(4000);
    expect(melon.manage.variantLabels).toEqual(['Large', 'Small']);
    expect(melon.manage.totalStock).toBe(5);
  });

  it('counts the same filtered set in the pagination total', async () => {
    const owner = await getProducts('?limit=2&page=2', aliceToken);
    const guest = await getProducts('?limit=2&page=2');

    expect(slugs(owner.body)).toEqual(['af-pear', 'af-apple']);
    expect(owner.body.pagination).toEqual({ page: 2, limit: 2, total: 4, totalPages: 2 });
    expect(slugs(guest.body)).toEqual(['af-apple']);
    expect(guest.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });
});

describe('sorting and pagination', () => {
  it('sorts newest first by default, with the id as the tie-breaker', async () => {
    const res = await getProducts('?sort=newest', aliceToken);

    expect(slugs(res.body)).toEqual(['af-kiwi', 'af-fig', 'af-pear', 'af-apple']);
  });

  it('sorts popular by soldCount, then ratingCount, then id descending', async () => {
    const owner = await getProducts('?sort=popular', aliceToken);
    const guest = await getProducts('?sort=popular');

    // fig (30 sold, 8 ratings), then kiwi and pear tie on 30 sold and 2 ratings (higher id first), then apple.
    expect(slugs(owner.body)).toEqual(['af-fig', 'af-kiwi', 'af-pear', 'af-apple']);
    expect(slugs(guest.body)).toEqual(['af-kiwi', 'af-pear', 'af-apple']);
  });

  it.each(['newest', 'popular'])('never repeats or skips a product across pages with sort=%s', async (sort) => {
    const all = await getProducts(`?sort=${sort}&limit=48`, aliceToken);
    const seen: string[] = [];
    for (const page of [1, 2, 3, 4]) {
      seen.push(...slugs((await getProducts(`?sort=${sort}&limit=1&page=${page}`, aliceToken)).body));
    }

    expect(seen).toEqual(slugs(all.body));
    expect(new Set(seen).size).toBe(4);
  });

  it('returns 400 for an unknown sort, a limit above 48, bad numbers and unknown keys', async () => {
    const cases: [string, string][] = [
      ['?sort=other', 'sort'],
      ['?limit=49', 'limit'],
      ['?limit=0', 'limit'],
      ['?page=0', 'page'],
      ['?page=abc', 'page'],
    ];
    for (const [query, field] of cases) {
      const res = await getProducts(query);
      expect(res.status, query).toBe(400);
      expect(res.body.errors[field], query).toEqual(expect.any(String));
    }
    expect((await getProducts('?foo=bar')).status).toBe(400);
  });

  it('accepts limit 48', async () => {
    expect((await getProducts('?limit=48')).status).toBe(200);
  });
});

describe('GET /api/shops/:slug/products for other shops', () => {
  it('returns 404 for an unknown shop', async () => {
    const res = await request(app).get('/api/shops/unknown/products');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Shop not found.' });
  });

  it('returns only that shop\'s products', async () => {
    const res = await request(app).get('/api/shops/shop-b/products');

    expect(res.status).toBe(200);
    expect(res.body.products.every((p: { shop: { slug: string } }) => p.shop.slug === 'shop-b')).toBe(true);
    expect(res.body.pagination.total).toBe(2);
  });

  it('does not give owner data for a shop the viewer does not own', async () => {
    const res = await request(app).get('/api/shops/shop-b/products').set('Authorization', `Bearer ${aliceToken}`);

    expect(res.body.products.every((p: { manage: unknown }) => p.manage === null)).toBe(true);
  });
});
