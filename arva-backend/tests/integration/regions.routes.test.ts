import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { regionService } from '../../src/services/region.service.js';
import { regionId, resetDatabase, seedTestRegions } from '../helpers/db.js';

// Region endpoints are public, so no request below sends a token.
const app = createApp();

function names(body: { items: { name: string }[] }): string[] {
  return body.items.map((item) => item.name);
}

beforeEach(async () => {
  await resetDatabase();
  await seedTestRegions();
  // Each test starts with an empty one hour cache.
  regionService.clearCache();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('GET /api/regions/provinces', () => {
  it('returns the provinces sorted by name, without a token', async () => {
    const res = await request(app).get('/api/regions/provinces');

    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(['Bali', 'DKI Jakarta', 'Jawa Barat']);
    expect(res.body.items[0]).toEqual({ id: expect.any(String), name: 'Bali' });
  });

  it('is not captured by any other route', async () => {
    const res = await request(app).get('/api/regions/provinces');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['items']);
  });

  it('serves the cached list until the cache is cleared', async () => {
    await request(app).get('/api/regions/provinces').expect(200);
    await prisma.province.create({ data: { id: 900, name: 'Aceh' } });

    const cached = await request(app).get('/api/regions/provinces');
    regionService.clearCache();
    const fresh = await request(app).get('/api/regions/provinces');

    expect(names(cached.body)).not.toContain('Aceh');
    expect(names(fresh.body)).toContain('Aceh');
  });
});

describe('GET /api/regions/provinces/:id/cities', () => {
  it("returns only that province's cities, sorted by name", async () => {
    const jakarta = await regionId('province', 'DKI Jakarta');
    const jawaBarat = await regionId('province', 'Jawa Barat');

    const dki = await request(app).get(`/api/regions/provinces/${jakarta}/cities`);
    const jabar = await request(app).get(`/api/regions/provinces/${jawaBarat}/cities`);

    expect(dki.status).toBe(200);
    expect(names(dki.body)).toEqual(['Jakarta Pusat', 'Jakarta Selatan']);
    expect(names(jabar.body)).toEqual(['Kabupaten Bogor', 'Kota Bandung']);
  });

  it('returns 404 for an unknown province, and does not cache the 404', async () => {
    const missing = await request(app).get('/api/regions/provinces/900/cities');
    await prisma.province.create({ data: { id: 900, name: 'Aceh' } });
    const found = await request(app).get('/api/regions/provinces/900/cities');

    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: 'Province not found.' });
    expect(found.status).toBe(200);
    expect(found.body).toEqual({ items: [] });
  });

  it('returns 400 for an id that is not numeric', async () => {
    const res = await request(app).get('/api/regions/provinces/abc/cities');

    expect(res.status).toBe(400);
    expect(res.body.errors.id).toEqual(expect.any(String));
  });
});

describe('GET /api/regions/cities/:id/districts', () => {
  it("returns only that city's districts, sorted by name", async () => {
    const selatan = await regionId('city', 'Jakarta Selatan');
    const bandung = await regionId('city', 'Kota Bandung');

    const south = await request(app).get(`/api/regions/cities/${selatan}/districts`);
    const bdg = await request(app).get(`/api/regions/cities/${bandung}/districts`);

    expect(south.status).toBe(200);
    expect(names(south.body)).toEqual(['Kebayoran Baru', 'Tebet']);
    expect(names(bdg.body)).toEqual(['Cicendo', 'Coblong']);
  });

  it('returns 404 for an unknown city and 400 for a bad id', async () => {
    const missing = await request(app).get('/api/regions/cities/99999/districts');
    const bad = await request(app).get('/api/regions/cities/x1/districts');

    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: 'City not found.' });
    expect(bad.status).toBe(400);
  });
});

describe('GET /api/regions/districts/:id/sub-districts', () => {
  it("returns only that district's sub-districts, sorted by name", async () => {
    const kebayoran = await regionId('district', 'Kebayoran Baru');

    const res = await request(app).get(`/api/regions/districts/${kebayoran}/sub-districts`);

    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(['Gunung', 'Melawai', 'Senayan']);
  });

  it('returns 404 for an unknown district and 400 for a bad id', async () => {
    const missing = await request(app).get('/api/regions/districts/99999/sub-districts');
    const bad = await request(app).get('/api/regions/districts/-1/sub-districts');

    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: 'District not found.' });
    expect(bad.status).toBe(400);
  });
});

describe('the seed data', () => {
  it('can be loaded twice without duplicating regions', async () => {
    const before = await prisma.subDistrict.count();

    await seedTestRegions();

    expect(await prisma.subDistrict.count()).toBe(before);
    expect(await prisma.province.count()).toBe(3);
    expect(await prisma.city.count()).toBe(5);
  });
});
