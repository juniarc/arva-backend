import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { createExtraProduct, createShop, resetDatabase, seedFixtures, type Fixtures } from '../helpers/db.js';

const app = createApp();
let fixtures: Fixtures;

function slugs(body: { products: { slug: string }[] }): string[] {
  return body.products.map((product) => product.slug);
}

beforeAll(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('GET /api/products with shop and exclude', () => {
  it('returns only the products of one shop, and not inactive ones', async () => {
    const res = await request(app).get('/api/products?shop=shops-name');

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'cucumber']);
    expect(res.body.products.every((p: { shopSlug: string }) => p.shopSlug === 'shops-name')).toBe(true);
    expect(res.body.pagination.total).toBe(2);
  });

  it('returns 400 for an unknown shop', async () => {
    const res = await request(app).get('/api/products?shop=unknown');

    expect(res.status).toBe(400);
    expect(res.body.errors.shop).toBe('Shop not found.');
  });

  it('leaves out the excluded product', async () => {
    const id = fixtures.productIds['bali-banana-fruit'];
    const res = await request(app).get(`/api/products?exclude=${id}`);

    expect(slugs(res.body)).toEqual(['mango', 'cucumber', 'sprayer']);
    expect(res.body.pagination.total).toBe(3);
  });

  it('combines shop, exclude, category and sort', async () => {
    const id = fixtures.productIds['bali-banana-fruit'];
    const res = await request(app).get(`/api/products?shop=shops-name&exclude=${id}&sort=price_asc`);

    expect(slugs(res.body)).toEqual(['cucumber']);

    const none = await request(app).get('/api/products?shop=shops-name&category=equipments');
    expect(none.body.products).toEqual([]);
  });

  it('returns 400 for a non-numeric exclude', async () => {
    const res = await request(app).get('/api/products?exclude=abc');

    expect(res.status).toBe(400);
    expect(res.body.errors.exclude).toEqual(expect.any(String));
  });

  it('includes shopSlug in each list item', async () => {
    const res = await request(app).get('/api/products');

    expect(res.body.products[0]).toMatchObject({ slug: 'bali-banana-fruit', shopSlug: 'shops-name', city: 'Jakarta' });
  });
});

describe('GET /api/products/recommended', () => {
  it('is matched before /:slug (route order)', async () => {
    const res = await request(app).get('/api/products/recommended');

    expect(res.status).toBe(200);
    expect(res.body.products).toBeInstanceOf(Array);
    // If "recommended" were read as a slug, this would be 404 "Product not found."
    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'mango', 'cucumber', 'sprayer']);
  });

  it('excludes the given product and every product of excludeShop', async () => {
    const id = fixtures.productIds['mango'];
    const res = await request(app).get(`/api/products/recommended?exclude=${id}&excludeShop=shops-name`);

    // shops-name has the banana, cucumber and hidden. mango is excluded by id. Only the sprayer is left.
    expect(slugs(res.body)).toEqual(['sprayer']);
    expect(res.body.products.every((p: { shopSlug: string }) => p.shopSlug !== 'shops-name')).toBe(true);
  });

  it('respects limit and orders by soldCount', async () => {
    const res = await request(app).get('/api/products/recommended?limit=2');

    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'mango']);
  });

  it('returns 400 for a bad limit and for unknown query keys', async () => {
    const tooMany = await request(app).get('/api/products/recommended?limit=25');
    const unknownKey = await request(app).get('/api/products/recommended?category=fruits');

    expect(tooMany.status).toBe(400);
    expect(tooMany.body.errors.limit).toEqual(expect.any(String));
    expect(unknownKey.status).toBe(400);
  });

  it('still serves a product whose slug starts with the same letters', async () => {
    const res = await request(app).get('/api/products/bali-banana-fruit');

    expect(res.status).toBe(200);
    expect(res.body.product.slug).toBe('bali-banana-fruit');
  });
});

describe('GET /api/products with price, rating, city and relevance', () => {
  // Fixture products (all rated 3.4): banana 1000 (Jakarta, sold 500), mango 2000 (Kab. B, sold 300),
  // cucumber 500 (Jakarta, sold 100), sprayer 3000 (Kab. B, sold 50).
  // Extra products in "Kab. Bandung", all sold 300:
  //   two-variant: prices 800 and 6000, rating 4.5, ratingCount 10
  //   unrated:     price 1000, no rating
  //   tied-a:      price 1000, rating 4.0, ratingCount 10
  //   tied-b:      price 1000, rating 4.0, ratingCount 20
  const extraIds: number[] = [];
  let shopId = 0;

  beforeAll(async () => {
    shopId = await createShop('shop-c', 'Kab. Bandung');
    const base = { shopId, soldCount: 300 };
    extraIds.push(
      await createExtraProduct({ ...base, slug: 'two-variant', prices: [800, 6000], ratingTenths: 45, ratingCount: 10 }),
      await createExtraProduct({ ...base, slug: 'unrated', prices: [1000] }),
      await createExtraProduct({ ...base, slug: 'tied-a', prices: [1000], ratingTenths: 40, ratingCount: 10 }),
      await createExtraProduct({ ...base, slug: 'tied-b', prices: [1000], ratingTenths: 40, ratingCount: 20 }),
    );
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: extraIds } } });
    await prisma.shop.deleteMany({ where: { id: shopId } });
  });

  const get = (query: string) => request(app).get(`/api/products?${query}`);

  it('minPrice keeps products whose lowest price is at or above it', async () => {
    const res = await get('minPrice=1000&sort=price_asc');

    // Ties at 1000 are ordered by id: banana, then the extras in creation order.
    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'unrated', 'tied-a', 'tied-b', 'mango', 'sprayer']);
    expect(res.body.pagination.total).toBe(6);
  });

  it('maxPrice keeps products whose lowest price is at or below it', async () => {
    const res = await get('maxPrice=800&sort=price_asc');

    expect(slugs(res.body)).toEqual(['cucumber', 'two-variant']);
  });

  it('minPrice and maxPrice together use the lowest price, not any variant', async () => {
    const inRange = await get('minPrice=600&maxPrice=1000&sort=price_asc');
    // two-variant has a 6000 variant inside this range, but its lowest price (800) is outside it.
    const highVariantOnly = await get('minPrice=5000&maxPrice=7000');

    expect(slugs(inRange.body)).toEqual(['two-variant', 'bali-banana-fruit', 'unrated', 'tied-a', 'tied-b']);
    expect(highVariantOnly.body.products).toEqual([]);
    expect(highVariantOnly.body.pagination.total).toBe(0);
  });

  it('accepts minPrice equal to maxPrice', async () => {
    const res = await get('minPrice=500&maxPrice=500');

    expect(slugs(res.body)).toEqual(['cucumber']);
  });

  it('minRating excludes lower rated and unrated products', async () => {
    const res = await get('minRating=4');

    expect(slugs(res.body)).toEqual(['two-variant', 'tied-a', 'tied-b']);
    expect((await get('minRating=5')).body.products).toEqual([]);
  });

  it('city keeps only products of shops in that city', async () => {
    const res = await get('city=Jakarta');

    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'cucumber']);
    expect(res.body.products.every((p: { city: string }) => p.city === 'Jakarta')).toBe(true);
  });

  it('trims the city before matching', async () => {
    const res = await get('city=%20Kab.%20Bandung%20&sort=price_asc');

    expect(slugs(res.body)).toEqual(['two-variant', 'unrated', 'tied-a', 'tied-b']);
  });

  it('returns 200 with an empty list for an unknown city', async () => {
    const res = await get('city=Unknown');

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
    expect(res.body.pagination).toMatchObject({ total: 0, totalPages: 0 });
  });

  it('matches city case-sensitively', async () => {
    const res = await get('city=jakarta');

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  it('sort=relevance orders by soldCount, then ratingCount, then id', async () => {
    const res = await get('sort=relevance');

    expect(slugs(res.body)).toEqual([
      'bali-banana-fruit', // sold 500
      'tied-b', // sold 300, 20 ratings
      'two-variant', // sold 300, 10 ratings, lower id
      'tied-a', // sold 300, 10 ratings
      'mango', // sold 300, 0 ratings, lower id
      'unrated', // sold 300, 0 ratings
      'cucumber',
      'sprayer',
    ]);
  });

  it('sort=popular breaks soldCount ties by rating, then id', async () => {
    const res = await get('sort=popular');

    expect(slugs(res.body)).toEqual([
      'bali-banana-fruit',
      'two-variant', // sold 300, rating 4.5
      'tied-a', // rating 4.0, lower id
      'tied-b',
      'mango', // rating 3.4
      'unrated', // rating 0
      'cucumber',
      'sprayer',
    ]);
  });

  it.each(['popular', 'newest', 'price_asc', 'price_desc', 'relevance'])(
    'sort=%s never repeats or skips a product across pages',
    async (sort) => {
      const all = await get(`sort=${sort}&limit=48`);
      const seen: string[] = [];
      for (const page of [1, 2, 3]) {
        const res = await get(`sort=${sort}&limit=3&page=${page}`);
        expect(res.status).toBe(200);
        seen.push(...slugs(res.body));
      }

      expect(all.body.pagination.total).toBe(8);
      expect(new Set(seen).size).toBe(8);
      expect(seen).toEqual(slugs(all.body));
    },
  );

  it('combines every filter and counts the same filtered set', async () => {
    const res = await get('category=fruits&minPrice=600&maxPrice=1000&minRating=4&city=Kab.%20Bandung&sort=price_asc');

    expect(slugs(res.body)).toEqual(['two-variant', 'tied-a', 'tied-b']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 12, total: 3, totalPages: 1 });
  });

  it('combines the discount filter with price and city', async () => {
    const res = await get('discount=true&minPrice=1000&city=Jakarta');

    expect(slugs(res.body)).toEqual(['bali-banana-fruit']);
  });

  it('paginates a filtered set with the right total', async () => {
    const res = await get('category=fruits&minPrice=600&maxPrice=1000&sort=price_asc&limit=2&page=2');

    // Full list: two-variant, banana, unrated, tied-a, tied-b.
    expect(slugs(res.body)).toEqual(['unrated', 'tied-a']);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('counts the filtered set, not the whole table', async () => {
    const res = await get('city=Jakarta&limit=1');

    expect(res.body.products).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it('returns 400 when minPrice is greater than maxPrice', async () => {
    const res = await get('minPrice=5000&maxPrice=1000');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('The minimum price cannot be greater than the maximum price.');
    expect(res.body.errors.minPrice).toEqual(expect.any(String));
  });

  it('returns 400 for non-numeric or out of range values', async () => {
    const cases: [string, string][] = [
      ['minPrice=abc', 'minPrice'],
      ['maxPrice=-5', 'maxPrice'],
      ['minRating=0', 'minRating'],
      ['minRating=6', 'minRating'],
      ['minRating=abc', 'minRating'],
      ['city=%20%20', 'city'],
      ['sort=cheapest', 'sort'],
    ];
    for (const [query, field] of cases) {
      const res = await get(query);
      expect(res.status, query).toBe(400);
      expect(res.body.errors[field], query).toEqual(expect.any(String));
    }
  });

  it('returns 400 for an unknown query parameter', async () => {
    const res = await get('foo=bar');

    expect(res.status).toBe(400);
    expect(res.body.errors.foo).toEqual(expect.any(String));
  });
});

describe('rate limit on public product endpoints', () => {
  it('returns 429 after 120 requests per minute from one IP', async () => {
    const freshApp = createApp();
    let last = 200;
    for (let i = 0; i < 121; i++) {
      last = (await request(freshApp).get('/api/products/recommended?limit=1')).status;
    }

    expect(last).toBe(429);
    const res = await request(freshApp).get('/api/products/recommended?limit=1');
    expect(res.body).toEqual({ message: 'Too many requests. Please try again later.' });
  }, 60_000);
});
