import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase, seedFixtures } from '../helpers/db.js';

const app = createApp();

beforeAll(async () => {
  await resetDatabase();
  await seedFixtures();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('GET /api/products/:slug/reviews', () => {
  it('returns the visible reviews, newest first, with pagination', async () => {
    const res = await request(app).get('/api/products/bali-banana-fruit/reviews');

    expect(res.status).toBe(200);
    expect(res.body.reviews.map((r: { text: string }) => r.text)).toEqual(['First', 'Second', 'Third']);
    expect(res.body.reviews[1].authorAvatarUrl).toBeNull();
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/userId|email|isVisible|hidden/i);
  });

  it('paginates with limit=2', async () => {
    const first = await request(app).get('/api/products/bali-banana-fruit/reviews?limit=2');
    const second = await request(app).get('/api/products/bali-banana-fruit/reviews?limit=2&page=2');

    expect(first.body.reviews).toHaveLength(2);
    expect(first.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(second.body.reviews.map((r: { text: string }) => r.text)).toEqual(['Third']);
  });

  it('returns an empty list for a product without reviews', async () => {
    const res = await request(app).get('/api/products/cucumber/reviews');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      reviews: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('returns 400 for limit=51, page=0 and unknown query keys', async () => {
    const tooMany = await request(app).get('/api/products/bali-banana-fruit/reviews?limit=51');
    const badPage = await request(app).get('/api/products/bali-banana-fruit/reviews?page=0');
    const unknownKey = await request(app).get('/api/products/bali-banana-fruit/reviews?sort=old');

    expect(tooMany.status).toBe(400);
    expect(tooMany.body.errors.limit).toEqual(expect.any(String));
    expect(badPage.status).toBe(400);
    expect(unknownKey.status).toBe(400);
    expect(unknownKey.body.errors.sort).toEqual(expect.any(String));
  });

  it('returns 404 for an unknown or inactive product', async () => {
    const unknown = await request(app).get('/api/products/unknown/reviews');
    const inactive = await request(app).get('/api/products/hidden/reviews');

    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ message: 'Product not found.' });
    expect(inactive.status).toBe(404);
  });
});
