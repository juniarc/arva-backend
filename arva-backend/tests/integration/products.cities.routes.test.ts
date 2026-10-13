import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { productCityService } from '../../src/services/product-city.service.js';
import { createExtraProduct, createShop, resetDatabase, seedFixtures } from '../helpers/db.js';

const app = createApp();

// Fixture shops: "Jakarta" and "Kab. B", both with active products.
beforeEach(async () => {
  await resetDatabase();
  await seedFixtures();
  // Each test starts with an empty 60 second cache.
  productCityService.clearCache();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('GET /api/products/cities', () => {
  it('is matched before /:slug (route order)', async () => {
    const res = await request(app).get('/api/products/cities');

    // If "cities" were read as a product slug, this would be 404 "Product not found."
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['cities']);
  });

  it('returns sorted unique cities, ignoring case, and only cities with active products', async () => {
    // A second shop in Jakarta (duplicate), a lowercase city, a city with only an inactive
    // product, and a city with no products.
    await createExtraProduct({ slug: 'dup', shopId: await createShop('shop-dup', 'Jakarta'), prices: [100] });
    await createExtraProduct({ slug: 'alpha', shopId: await createShop('shop-alpha', 'kab. alpha'), prices: [100] });
    await createExtraProduct({
      slug: 'ghost',
      shopId: await createShop('shop-ghost', 'Kab. Hidden'),
      prices: [100],
      isActive: false,
    });
    await createShop('shop-empty', 'Kab. Empty');

    const res = await request(app).get('/api/products/cities');

    expect(res.status).toBe(200);
    expect(res.body.cities).toEqual(['Jakarta', 'kab. alpha', 'Kab. B']);
  });

  it('returns only city strings, no shop data', async () => {
    const res = await request(app).get('/api/products/cities');

    expect(res.body).toEqual({ cities: ['Jakarta', 'Kab. B'] });
  });

  it('serves the cached list for 60 seconds', async () => {
    await request(app).get('/api/products/cities').expect(200);
    await createExtraProduct({ slug: 'late', shopId: await createShop('shop-late', 'Kab. Late'), prices: [100] });

    const cached = await request(app).get('/api/products/cities');
    productCityService.clearCache();
    const fresh = await request(app).get('/api/products/cities');

    expect(cached.body.cities).toEqual(['Jakarta', 'Kab. B']);
    expect(fresh.body.cities).toEqual(['Jakarta', 'Kab. B', 'Kab. Late']);
  });

  it('does not shadow a product page', async () => {
    const res = await request(app).get('/api/products/bali-banana-fruit');

    expect(res.status).toBe(200);
  });
});
