import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  createOwnedShop,
  regionId,
  registerAndLogin,
  resetDatabase,
  seedFixtures,
  seedTestChannels,
  seedTestRegions,
} from '../helpers/db.js';

// alice already owns "alice-farm". bob and carol own nothing. "shop-b" (name "Shop B") has no owner.
let app: ReturnType<typeof createApp>;
let aliceToken: string;
let bobToken: string;
let carolToken: string;
let jne: number;
let jnt: number;

beforeEach(async () => {
  await resetDatabase();
  await seedFixtures();
  await seedTestRegions();
  await seedTestChannels();
  // A fresh app gives fresh rate-limit counters.
  app = createApp();
  aliceToken = await registerAndLogin(app, 'alice');
  bobToken = await registerAndLogin(app, 'bob');
  carolToken = await registerAndLogin(app, 'carol');
  await createOwnedShop({ slug: 'alice-farm', name: 'Alice Farm', ownerUsername: 'alice' });
  jne = (await prisma.shippingChannel.findUniqueOrThrow({ where: { name: 'JNE' } })).id;
  jnt = (await prisma.shippingChannel.findUniqueOrThrow({ where: { name: 'J&T Express' } })).id;
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

async function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'New Farm',
    provinceId: String(await regionId('province', 'Bali')),
    cityId: String(await regionId('city', 'Kota Denpasar')),
    districtId: String(await regionId('district', 'Denpasar Selatan')),
    subDistrictId: String(await regionId('subDistrict', 'Sanur')),
    street: 'Jl. Pantai 9',
    email: 'New@Farm.COM',
    phone: '+6281299998888',
    openingTime: '09:00',
    closingTime: '19:00',
    shippingChannelIds: [String(jne), String(jnt)],
    ...overrides,
  };
}

function createShop(authToken: string, body: unknown) {
  return request(app).post('/api/shops').set('Authorization', `Bearer ${authToken}`).send(body as object);
}

describe('POST /api/shops', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/shops').send(await validBody());

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
  });

  it('creates the shop with a slug from the name, and returns the owner shop', async () => {
    const res = await createShop(bobToken, await validBody());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      shop: {
        slug: 'new-farm',
        name: 'New Farm',
        logoUrl: null,
        description: '',
        operatingHours: { open: '09:00', close: '19:00' },
        provinceId: expect.any(String),
        cityId: expect.any(String),
        districtId: expect.any(String),
        subDistrictId: expect.any(String),
        street: 'Jl. Pantai 9',
        zipCode: null,
        email: 'new@farm.com',
        phone: '+6281299998888',
        shippingChannelIds: [String(jne), String(jnt)],
      },
    });
  });

  it('makes the user the owner, and saves the city name for the product list', async () => {
    await createShop(bobToken, await validBody()).expect(201);

    const bob = await prisma.user.findUniqueOrThrow({ where: { usernameLower: 'bob' }, select: { id: true } });
    const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: 'new-farm' } });
    expect(shop.ownerId).toBe(bob.id);
    expect(shop.city).toBe('Kota Denpasar');
    expect(shop.ratingCount).toBe(0);
  });

  it('can be read and updated through /shops/me and the public page afterwards', async () => {
    await createShop(bobToken, await validBody()).expect(201);

    const me = await request(app).get('/api/shops/me').set('Authorization', `Bearer ${bobToken}`);
    const page = await request(app).get('/api/shops/new-farm').set('Authorization', `Bearer ${bobToken}`);
    const update = await request(app)
      .put('/api/shops/me')
      .set('Authorization', `Bearer ${bobToken}`)
      .send(await validBody({ name: 'Renamed Farm' }));

    expect(me.status).toBe(200);
    expect(page.body.shop.isOwner).toBe(true);
    expect(update.status).toBe(200);
    expect(update.body.shop.slug).toBe('new-farm');
  });

  it('accepts an optional description and zip code', async () => {
    const res = await createShop(bobToken, await validBody({ description: 'We grow things.', zipCode: '80228' }));

    expect(res.status).toBe(201);
    expect(res.body.shop).toMatchObject({ description: 'We grow things.', zipCode: '80228' });
  });

  it('adds a number to the slug when two names give the same slug', async () => {
    await createShop(bobToken, await validBody({ name: 'Fresh Farm!' })).expect(201);

    const res = await createShop(carolToken, await validBody({ name: 'Fresh Farm?', email: 'c@farm.com' }));

    expect(res.status).toBe(201);
    expect(res.body.shop.slug).toBe('fresh-farm-2');
  });

  it('returns 409 SHOP_ALREADY_EXISTS for a user who already has a shop', async () => {
    const res = await createShop(aliceToken, await validBody());

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'You already have a shop.', code: 'SHOP_ALREADY_EXISTS' });
    expect(await prisma.shop.count({ where: { name: 'New Farm' } })).toBe(0);
  });

  it('lets only one of two parallel creates by the same user succeed', async () => {
    const [first, second] = await Promise.all([
      createShop(bobToken, await validBody({ name: 'Bob One' })),
      createShop(bobToken, await validBody({ name: 'Bob Two' })),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.code).toBe('SHOP_ALREADY_EXISTS');
    const bob = await prisma.user.findUniqueOrThrow({ where: { usernameLower: 'bob' }, select: { id: true } });
    expect(await prisma.shop.count({ where: { ownerId: bob.id } })).toBe(1);
  });

  it("returns 409 with field name for another shop's name in a different letter case", async () => {
    const res = await createShop(bobToken, await validBody({ name: 'sHoP b' }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'This shop name is already taken.', field: 'name' });
  });

  it('lets only one of two parallel creates by different users claim the same name', async () => {
    const [first, second] = await Promise.all([
      createShop(bobToken, await validBody({ name: 'Same Name' })),
      createShop(carolToken, await validBody({ name: 'Same Name', email: 'c@farm.com' })),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body).toEqual({ message: 'This shop name is already taken.', field: 'name' });
    expect(await prisma.shop.count({ where: { name: 'Same Name' } })).toBe(1);
  });

  it('returns 400 with errors.cityId for a city from another province', async () => {
    const res = await createShop(bobToken, await validBody({ cityId: String(await regionId('city', 'Kota Bandung')) }));

    expect(res.status).toBe(400);
    expect(res.body.errors.cityId).toBe('This city is not in the selected province.');
    expect(await prisma.shop.count({ where: { name: 'New Farm' } })).toBe(0);
  });

  it('returns 400 for closing time that is not later than opening, and for bad times', async () => {
    const early = await createShop(bobToken, await validBody({ openingTime: '19:00', closingTime: '09:00' }));
    const bad = await createShop(bobToken, await validBody({ openingTime: '9:00' }));

    expect(early.body.errors.closingTime).toBe('Closing time must be later than opening time.');
    expect(bad.body.errors.openingTime).toEqual(expect.any(String));
  });

  it('returns 400 for no shipping channel, an unknown one, and a bad phone', async () => {
    const empty = await createShop(bobToken, await validBody({ shippingChannelIds: [] }));
    const unknown = await createShop(bobToken, await validBody({ shippingChannelIds: ['99999'] }));
    const phone = await createShop(bobToken, await validBody({ phone: '+62 812' }));

    expect(empty.body.errors.shippingChannelIds).toEqual(expect.any(String));
    expect(unknown.body.errors.shippingChannelIds).toBe('Unknown shipping channel.');
    expect(phone.body.errors.phone).toBe('Invalid phone number format.');
  });

  it('returns 400 for missing fields and for fields that cannot be sent (owner, slug, logo)', async () => {
    const missing = await createShop(bobToken, {});
    const extra = await createShop(bobToken, await validBody({ ownerId: 1, slug: 'mine', logoUrl: 'x' }));

    expect(Object.keys(missing.body.errors).sort()).toEqual([
      'closingTime',
      'cityId',
      'districtId',
      'email',
      'name',
      'openingTime',
      'phone',
      'provinceId',
      'shippingChannelIds',
      'street',
      'subDistrictId',
    ].sort());
    expect(extra.status).toBe(400);
    expect(Object.keys(extra.body.errors).sort()).toEqual(['logoUrl', 'ownerId', 'slug']);
  });

  it('returns 429 after 20 requests per minute for one user', async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await createShop(bobToken, {})).status;
    }

    expect(last).toBe(429);
  });
});
