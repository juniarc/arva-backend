import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase, seedFixtures } from '../helpers/db.js';

const app = createApp();

const productShape = {
  id: expect.any(String),
  slug: expect.any(String),
  name: expect.any(String),
  categorySlug: expect.any(String),
  categoryName: expect.any(String),
  price: expect.any(Number),
  originalPrice: null,
  discountPercent: null,
  rating: expect.any(Number),
  soldCount: expect.any(Number),
  city: expect.any(String),
  imageUrl: expect.any(String),
  shopSlug: expect.any(String),
  shopName: expect.any(String),
};

// Read-only tests, so the data is created once.
beforeAll(async () => {
  await resetDatabase();
  await seedFixtures();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('GET /api/home', () => {
  it('returns all banner groups, with only active banners ordered by position', async () => {
    const res = await request(app).get('/api/home');

    expect(res.status).toBe(200);
    expect(res.body.banners.carousel.map((b: { title: string }) => b.title)).toEqual([
      'Carousel 1',
      'Carousel 2',
    ]);
    expect(res.body.banners.promoStrips).toHaveLength(1);
    expect(res.body.banners.sideBanners).toHaveLength(1);
    expect(res.body.banners.verticalBanners).toHaveLength(1);
    expect(res.body.banners.carousel[0]).toEqual({
      id: expect.any(String),
      title: 'Carousel 1',
      subtitle: 'Sub',
      buttonLabel: 'Go',
      linkUrl: '/products',
      imageUrl: '/c1.jpg',
    });
  });

  it('returns the popular, fruits and equipments sections', async () => {
    const res = await request(app).get('/api/home');
    const { popular, fruits, equipments } = res.body.sections;

    // Ordered by soldCount. The inactive product (9999 sold) is not shown.
    expect(popular.map((p: { slug: string }) => p.slug)).toEqual([
      'bali-banana-fruit',
      'mango',
      'cucumber',
      'sprayer',
    ]);
    expect(fruits.map((p: { slug: string }) => p.slug)).toEqual(['bali-banana-fruit', 'mango']);
    expect(equipments.map((p: { slug: string }) => p.slug)).toEqual(['sprayer']);
  });

  it('returns products in the Product shape, without internal fields', async () => {
    const res = await request(app).get('/api/home');
    const mango = res.body.sections.popular.find((p: { slug: string }) => p.slug === 'mango');
    const banana = res.body.sections.popular.find((p: { slug: string }) => p.slug === 'bali-banana-fruit');

    expect(mango).toEqual({
      ...productShape,
      id: expect.any(String),
      slug: 'mango',
      name: 'mango',
      categorySlug: 'fruits',
      categoryName: 'Fruits',
      price: 2000,
      rating: 3.4,
      soldCount: 300,
      city: 'Kab. B',
      shopSlug: 'shop-b',
      shopName: 'Shop B',
      imageUrl: '/images/dummy/mango.jpg',
    });
    expect(banana).toMatchObject({ price: 1000, originalPrice: 1250, discountPercent: 20 });
    expect(JSON.stringify(res.body)).not.toMatch(/ownerId|isActive|createdAt/);
  });
});

describe('GET /api/categories', () => {
  it('returns the five categories in sortOrder', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([
      { id: expect.any(String), slug: 'seeds', name: 'Seeds', iconKey: 'seeds' },
      { id: expect.any(String), slug: 'vegetables', name: 'Vegetables', iconKey: 'vegetables' },
      { id: expect.any(String), slug: 'fruits', name: 'Fruits', iconKey: 'fruits' },
      { id: expect.any(String), slug: 'fertilizers', name: 'Fertilizers', iconKey: 'fertilizers' },
      { id: expect.any(String), slug: 'equipments', name: 'Equipments', iconKey: 'equipments' },
    ]);
  });
});
