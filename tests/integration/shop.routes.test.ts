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

describe('GET /api/shops/:slug', () => {
  it('returns the shop profile and counts only active products', async () => {
    const res = await request(app).get('/api/shops/shops-name');

    expect(res.status).toBe(200);
    // The shop has three products, and one of them ("hidden") is inactive.
    expect(res.body).toEqual({
      shop: {
        slug: 'shops-name',
        name: "Shop's Name",
        city: 'Jakarta',
        logoUrl: '/images/dummy/shop-logo-placeholder.jpg',
        description: '',
        // No hours are saved for this fixture shop, so the API returns 00:00 and 00:00.
        operatingHours: { open: '00:00', close: '00:00' },
        rating: { average: 3.4, ratingCount: 212 },
        productCount: 2,
        isOwner: false,
        ownerDetails: null,
      },
    });
  });

  it('returns null for a missing logo and zero rating for an unrated shop', async () => {
    const res = await request(app).get('/api/shops/shop-b');

    expect(res.body.shop.logoUrl).toBeNull();
    expect(res.body.shop.rating).toEqual({ average: 0, ratingCount: 0 });
    expect(res.body.shop.productCount).toBe(2);
  });

  it('does not expose the owner', async () => {
    const res = await request(app).get('/api/shops/shops-name');

    expect(JSON.stringify(res.body)).not.toMatch(/ownerId|userId|email|phone/i);
  });

  it('returns 404 for an unknown shop', async () => {
    const res = await request(app).get('/api/shops/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Shop not found.' });
  });
});
