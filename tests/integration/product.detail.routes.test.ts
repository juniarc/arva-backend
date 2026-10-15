import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase, seedFixtures, type Fixtures } from '../helpers/db.js';

const app = createApp();
let fixtures: Fixtures;

beforeAll(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('GET /api/products/:slug', () => {
  it('returns images, ordered variants, default variant, shop and rating', async () => {
    const res = await request(app).get('/api/products/bali-banana-fruit');

    expect(res.status).toBe(200);
    const { product } = res.body;

    expect(product.images).toHaveLength(6);
    expect(product.images.map((i: { alt: string }) => i.alt)).toEqual([
      'bali-banana-fruit image 1',
      'bali-banana-fruit image 2',
      'bali-banana-fruit image 3',
      'bali-banana-fruit image 4',
      'bali-banana-fruit image 5',
      'bali-banana-fruit image 6',
    ]);

    // "2 kg" was created first, but "1 kg" has position 0.
    expect(product.variants.map((v: { label: string }) => v.label)).toEqual(['1 kg', '2 kg']);
    expect(product.defaultVariantId).toBe(String(fixtures.variantIds['bali-banana-fruit/1 kg']));
    expect(product.variants[0]).toEqual({
      id: String(fixtures.variantIds['bali-banana-fruit/1 kg']),
      label: '1 kg',
      unit: 'kg',
      price: 1000,
      originalPrice: 1250,
      stock: 10,
    });

    expect(product.shop).toEqual({
      slug: 'shops-name',
      name: "Shop's Name",
      city: 'Jakarta',
      logoUrl: '/images/dummy/shop-logo-placeholder.jpg',
      rating: { average: 3.4, ratingCount: 212 },
    });
    expect(product.rating).toEqual({ average: 3.4, ratingCount: 212, reviewCount: 104 });
    expect(product).toMatchObject({
      id: String(fixtures.productIds['bali-banana-fruit']),
      slug: 'bali-banana-fruit',
      description: 'Banana Fruit from Bali, Indonesia.',
      categorySlug: 'fruits',
      categoryName: 'Fruits',
      soldCount: 500,
    });
  });

  it('returns a review preview with visible reviews only, newest first', async () => {
    const res = await request(app).get('/api/products/bali-banana-fruit');

    expect(res.body.product.reviewPreview.map((r: { text: string }) => r.text)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
    expect(res.body.product.reviewPreview[0]).toEqual({
      id: expect.any(String),
      authorName: 'username',
      authorAvatarUrl: '/images/dummy/avatar-1.jpg',
      rating: 4,
      text: 'First',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
    });
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).get('/api/products/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Product not found.' });
  });

  it('returns 404 for an inactive product', async () => {
    const res = await request(app).get('/api/products/hidden');

    expect(res.status).toBe(404);
  });

  it('does not contain userId, email, isActive or ownerId anywhere', async () => {
    const res = await request(app).get('/api/products/bali-banana-fruit');

    expect(JSON.stringify(res.body)).not.toMatch(/userId|email|isActive|ownerId|isVisible/);
  });
});
