import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase, seedFixtures } from '../helpers/db.js';

const app = createApp();

function slugs(body: { products: { slug: string }[] }): string[] {
  return body.products.map((product) => product.slug);
}

beforeAll(async () => {
  await resetDatabase();
  await seedFixtures();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('GET /api/products', () => {
  it('returns active products sorted by popularity with pagination', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'mango', 'cucumber', 'sprayer']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 12, total: 4, totalPages: 1 });
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/products?category=fruits');

    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'mango']);
    expect(res.body.products.every((p: { categorySlug: string }) => p.categorySlug === 'fruits')).toBe(true);
  });

  it('returns only discounted products with discount=true', async () => {
    const res = await request(app).get('/api/products?discount=true');

    expect(slugs(res.body)).toEqual(['bali-banana-fruit', 'sprayer']);
  });

  it('ignores the discount filter with discount=false', async () => {
    const res = await request(app).get('/api/products?discount=false');

    expect(res.body.products).toHaveLength(4);
  });

  it('sorts by lowest variant price with sort=price_asc and price_desc', async () => {
    const asc = await request(app).get('/api/products?sort=price_asc');
    const desc = await request(app).get('/api/products?sort=price_desc');

    expect(slugs(asc.body)).toEqual(['cucumber', 'bali-banana-fruit', 'mango', 'sprayer']);
    expect(slugs(desc.body)).toEqual(['sprayer', 'mango', 'bali-banana-fruit', 'cucumber']);
    expect(asc.body.products.map((p: { price: number }) => p.price)).toEqual([500, 1000, 2000, 3000]);
  });

  it('sorts by newest', async () => {
    const res = await request(app).get('/api/products?sort=newest');

    // Fixtures are created in order, so the last one created is the newest.
    expect(slugs(res.body)).toEqual(['sprayer', 'cucumber', 'mango', 'bali-banana-fruit']);
  });

  it('paginates', async () => {
    const res = await request(app).get('/api/products?sort=price_asc&limit=3&page=2');

    expect(slugs(res.body)).toEqual(['sprayer']);
    expect(res.body.pagination).toEqual({ page: 2, limit: 3, total: 4, totalPages: 2 });
  });

  it('returns 400 for an unknown category', async () => {
    const res = await request(app).get('/api/products?category=nope');

    expect(res.status).toBe(400);
    expect(res.body.errors.category).toBe('Unknown category.');
  });

  it('returns 400 for invalid query values', async () => {
    const res = await request(app).get('/api/products?sort=cheapest&page=0&limit=100&discount=maybe');

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['discount', 'limit', 'page', 'sort']);
  });
});
