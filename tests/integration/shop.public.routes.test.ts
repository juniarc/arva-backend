import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signToken } from '../../src/lib/token.js';
import {
  createExtraProduct,
  createOwnedShop,
  registerAndLogin,
  resetDatabase,
  seedFixtures,
  seedTestChannels,
  seedTestRegions,
} from '../helpers/db.js';

// Two users: alice owns "alice-farm" (full owner data), bob owns nothing.
// "shop-b" is a fixture shop with no owner. alice-farm has two active products and one inactive.
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
  const shopId = await createOwnedShop({
    slug: 'alice-farm',
    name: 'Alice Farm',
    ownerUsername: 'alice',
    channelNames: ['JNE', 'J&T Express'],
  });
  await createExtraProduct({ slug: 'af-apple', shopId, prices: [1000] });
  await createExtraProduct({ slug: 'af-pear', shopId, prices: [2000] });
  await createExtraProduct({ slug: 'af-fig', shopId, prices: [500], isActive: false });
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function getShop(slug: string, authHeader?: string) {
  const req = request(app).get(`/api/shops/${slug}`);
  return authHeader === undefined ? req : req.set('Authorization', authHeader);
}

describe('route order', () => {
  it('does not read "me" as a shop slug', async () => {
    const res = await request(app).get('/api/shops/me');

    // If "me" were read as a slug, this would be 404 "Shop not found." instead of 401.
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
  });

  it('does not read "alice-farm/products" as a slug', async () => {
    const res = await request(app).get('/api/shops/alice-farm/products');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body).not.toHaveProperty('shop');
  });
});

describe('GET /api/shops/:slug', () => {
  it('returns the shop to a guest with isOwner false and ownerDetails null', async () => {
    const res = await getShop('alice-farm');

    expect(res.status).toBe(200);
    expect(res.body.shop).toEqual({
      slug: 'alice-farm',
      name: 'Alice Farm',
      city: 'Kota Administrasi Jakarta Selatan',
      logoUrl: null,
      description: 'A fixture shop.',
      operatingHours: { open: '08:00', close: '17:00' },
      rating: { average: 0, ratingCount: 0 },
      productCount: 2,
      isOwner: false,
      ownerDetails: null,
    });
  });

  it('counts only active products', async () => {
    const res = await getShop('alice-farm');

    expect(res.body.shop.productCount).toBe(2);
    expect(await prisma.product.count({ where: { shop: { slug: 'alice-farm' } } })).toBe(3);
  });

  it('treats an invalid token as a guest, not as a 401', async () => {
    for (const header of ['Bearer not-a-real-token', 'Bearer', 'Basic abc', 'garbage']) {
      const res = await getShop('alice-farm', header);
      expect(res.status, header).toBe(200);
      expect(res.body.shop.isOwner).toBe(false);
      expect(res.body.shop.ownerDetails).toBeNull();
    }
  });

  it('treats a token signed with another secret as a guest', async () => {
    const forged = `${signToken({ id: 1, username: 'x' }).slice(0, -3)}abc`;

    const res = await getShop('alice-farm', `Bearer ${forged}`);

    expect(res.status).toBe(200);
    expect(res.body.shop.isOwner).toBe(false);
  });

  it('returns isOwner true and the full ownerDetails for the owner', async () => {
    const res = await getShop('alice-farm', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shop.isOwner).toBe(true);
    expect(res.body.shop.ownerDetails).toEqual({
      contact: { email: 'alice-farm@shop.example.com', phone: '+6281200001111' },
      address: {
        street: 'Jl. Toko 7',
        zipCode: '12110',
        province: { id: expect.any(String), name: 'DKI Jakarta' },
        city: { id: expect.any(String), name: 'Kota Administrasi Jakarta Selatan' },
        district: { id: expect.any(String), name: 'Kebayoran Baru' },
        subDistrict: { id: expect.any(String), name: 'Gunung' },
      },
      shippingChannels: [
        { id: expect.any(String), name: 'JNE' },
        { id: expect.any(String), name: 'J&T Express' },
      ],
    });
  });

  it('returns isOwner false and ownerDetails null for a user who does not own the shop', async () => {
    const res = await getShop('alice-farm', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shop.isOwner).toBe(false);
    expect(res.body.shop.ownerDetails).toBeNull();
  });

  it("does not contain the owner's email or phone anywhere for a non-owner", async () => {
    const guest = await getShop('alice-farm');
    const bob = await getShop('alice-farm', `Bearer ${bobToken}`);

    for (const res of [guest, bob]) {
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('alice-farm@shop.example.com');
      expect(text).not.toContain('1200001111');
      expect(text).not.toContain('Jl. Toko 7');
      expect(text).not.toMatch(/ownerId|userId/);
    }
  });

  it('is never the owner view for a shop without an owner', async () => {
    const res = await getShop('shop-b', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shop.isOwner).toBe(false);
    expect(res.body.shop.ownerDetails).toBeNull();
  });

  it('returns 00:00 hours and an empty description for a shop with none saved', async () => {
    const res = await getShop('shop-b');

    expect(res.body.shop.operatingHours).toEqual({ open: '00:00', close: '00:00' });
    expect(res.body.shop.description).toBe('');
  });

  it('returns null address in ownerDetails when the owner has not saved one', async () => {
    await prisma.shop.update({ where: { slug: 'alice-farm' }, data: { street: null } });

    const res = await getShop('alice-farm', `Bearer ${aliceToken}`);

    expect(res.body.shop.ownerDetails.address).toBeNull();
    expect(res.body.shop.ownerDetails.contact.email).toBe('alice-farm@shop.example.com');
  });

  it('is not cached by shared caches', async () => {
    const res = await getShop('alice-farm', `Bearer ${aliceToken}`);

    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('returns 404 for an unknown shop', async () => {
    const res = await getShop('unknown');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Shop not found.' });
  });
});
