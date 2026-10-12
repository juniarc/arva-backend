import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase, seedFixtures, type Fixtures } from '../helpers/db.js';

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
