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

// alice owns "alice-farm" (JNE only, zip 12110). bob owns nothing, until a test gives him a shop.
// "shop-b" is a fixture shop with no owner, named "Shop B".
let app: ReturnType<typeof createApp>;
let aliceToken: string;
let bobToken: string;
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
  await createOwnedShop({ slug: 'alice-farm', name: 'Alice Farm', ownerUsername: 'alice' });
  jne = (await prisma.shippingChannel.findUniqueOrThrow({ where: { name: 'JNE' } })).id;
  jnt = (await prisma.shippingChannel.findUniqueOrThrow({ where: { name: 'J&T Express' } })).id;
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

async function validBody() {
  return {
    name: 'Alice Farm Renamed',
    description: 'We grow things.',
    provinceId: String(await regionId('province', 'DKI Jakarta')),
    cityId: String(await regionId('city', 'Kota Administrasi Jakarta Selatan')),
    districtId: String(await regionId('district', 'Kebayoran Baru')),
    subDistrictId: String(await regionId('subDistrict', 'Gunung')),
    street: 'Jl. Baru 9',
    zipCode: '12120',
    email: 'Shop@Example.COM',
    phone: '+6281299998888',
    openingTime: '09:00',
    closingTime: '19:00',
    shippingChannelIds: [String(jne), String(jnt)],
  };
}

function getMe(authToken?: string) {
  const req = request(app).get('/api/shops/me');
  return authToken === undefined ? req : req.set('Authorization', `Bearer ${authToken}`);
}

function putMe(authToken: string, body: unknown) {
  return request(app).put('/api/shops/me').set('Authorization', `Bearer ${authToken}`).send(body as object);
}

async function shopRow(slug: string) {
  return prisma.shop.findUniqueOrThrow({ where: { slug } });
}

describe('GET /api/shops/me', () => {
  it('returns 401 without a token', async () => {
    const res = await getMe();

    expect(res.status).toBe(401);
  });

  it('returns 404 for a user who owns no shop', async () => {
    const res = await getMe(bobToken);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Shop not found.' });
  });

  it('returns the owner shop with flat region ids, operatingHours and channel ids', async () => {
    const res = await getMe(aliceToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      shop: {
        slug: 'alice-farm',
        name: 'Alice Farm',
        logoUrl: null,
        description: 'A fixture shop.',
        operatingHours: { open: '08:00', close: '17:00' },
        provinceId: String(await regionId('province', 'DKI Jakarta')),
        cityId: String(await regionId('city', 'Kota Administrasi Jakarta Selatan')),
        districtId: String(await regionId('district', 'Kebayoran Baru')),
        subDistrictId: String(await regionId('subDistrict', 'Gunung')),
        street: 'Jl. Toko 7',
        zipCode: '12110',
        email: 'alice-farm@shop.example.com',
        phone: '+6281200001111',
        shippingChannelIds: [String(jne)],
      },
    });
  });

  it('is not cached by shared caches', async () => {
    expect((await getMe(aliceToken)).headers['cache-control']).toBe('private, no-store');
  });
});

describe('PUT /api/shops/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/shops/me').send(await validBody());

    expect(res.status).toBe(401);
  });

  it('updates the shop and returns the full owner shop', async () => {
    const res = await putMe(aliceToken, await validBody());

    expect(res.status).toBe(200);
    expect(res.body.shop).toMatchObject({
      slug: 'alice-farm',
      name: 'Alice Farm Renamed',
      description: 'We grow things.',
      operatingHours: { open: '09:00', close: '19:00' },
      street: 'Jl. Baru 9',
      zipCode: '12120',
      email: 'shop@example.com',
      phone: '+6281299998888',
      shippingChannelIds: [String(jne), String(jnt)],
    });
    expect((await getMe(aliceToken)).body).toEqual(res.body);
  });

  it('keeps the slug when the name changes', async () => {
    await putMe(aliceToken, await validBody()).expect(200);

    expect((await shopRow('alice-farm')).name).toBe('Alice Farm Renamed');
    expect(await prisma.shop.count({ where: { slug: 'alice-farm-renamed' } })).toBe(0);
    expect((await request(app).get('/api/shops/alice-farm')).status).toBe(200);
  });

  it('stores the email in lowercase', async () => {
    await putMe(aliceToken, await validBody()).expect(200);

    expect((await shopRow('alice-farm')).email).toBe('shop@example.com');
  });

  it('changes the city String to match the chosen city', async () => {
    const res = await putMe(aliceToken, {
      ...(await validBody()),
      provinceId: String(await regionId('province', 'Bali')),
      cityId: String(await regionId('city', 'Kota Denpasar')),
      districtId: String(await regionId('district', 'Denpasar Selatan')),
      subDistrictId: String(await regionId('subDistrict', 'Sanur')),
    });

    expect(res.status).toBe(200);
    const shop = await shopRow('alice-farm');
    expect(shop.city).toBe('Kota Denpasar');
    expect(shop.slug).toBe('alice-farm');
    // The product list city filter reads this String.
    const list = await request(app).get('/api/products?city=Kota%20Denpasar');
    expect(list.status).toBe(200);
  });

  it('succeeds with the shop\'s own current name, also when only the letter case changes', async () => {
    const same = await putMe(aliceToken, { ...(await validBody()), name: 'Alice Farm' });
    const cased = await putMe(aliceToken, { ...(await validBody()), name: 'ALICE FARM' });

    expect(same.status).toBe(200);
    expect(cased.status).toBe(200);
    expect(cased.body.shop.name).toBe('ALICE FARM');
  });

  it("returns 409 with field name for another shop's name in a different letter case", async () => {
    const res = await putMe(aliceToken, { ...(await validBody()), name: 'sHoP b' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'This shop name is already taken.', field: 'name' });
    expect((await shopRow('alice-farm')).name).toBe('Alice Farm');
  });

  it('lets only one of two parallel updates claim the same new name', async () => {
    await createOwnedShop({ slug: 'bob-store', name: 'Bob Store', ownerUsername: 'bob' });
    const body = { ...(await validBody()), name: 'The Same Name' };

    const [first, second] = await Promise.all([putMe(aliceToken, body), putMe(bobToken, body)]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body).toEqual({ message: 'This shop name is already taken.', field: 'name' });
    expect(await prisma.shop.count({ where: { name: 'The Same Name' } })).toBe(1);
  });

  it('returns 400 with errors.cityId for a city from another province', async () => {
    const res = await putMe(aliceToken, {
      ...(await validBody()),
      cityId: String(await regionId('city', 'Kota Bandung')),
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.cityId).toBe('This city is not in the selected province.');
    expect((await shopRow('alice-farm')).name).toBe('Alice Farm');
  });

  it('returns 400 with the field name for a region id that does not exist', async () => {
    const res = await putMe(aliceToken, { ...(await validBody()), provinceId: '99999' });

    expect(res.status).toBe(400);
    expect(res.body.errors.provinceId).toBe('Province not found.');
  });

  it('returns 400 with errors.closingTime when closing is not later than opening', async () => {
    for (const [openingTime, closingTime] of [
      ['19:00', '09:00'],
      ['09:00', '09:00'],
    ]) {
      const res = await putMe(aliceToken, { ...(await validBody()), openingTime, closingTime });
      expect(res.status).toBe(400);
      expect(res.body.errors.closingTime).toBe('Closing time must be later than opening time.');
    }
  });

  it('returns 400 for times that are not HH:MM', async () => {
    const bad = await putMe(aliceToken, { ...(await validBody()), openingTime: '9:00', closingTime: '24:00' });

    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.errors).sort()).toEqual(['closingTime', 'openingTime']);
  });

  it('returns 400 for an empty shippingChannelIds, a duplicate, and an unknown channel id', async () => {
    const base = await validBody();

    const empty = await putMe(aliceToken, { ...base, shippingChannelIds: [] });
    const duplicate = await putMe(aliceToken, { ...base, shippingChannelIds: [String(jne), String(jne)] });
    const unknown = await putMe(aliceToken, { ...base, shippingChannelIds: [String(jne), '99999'] });

    expect(empty.status).toBe(400);
    expect(empty.body.errors.shippingChannelIds).toEqual(expect.any(String));
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.errors.shippingChannelIds).toEqual(expect.any(String));
    expect(unknown.status).toBe(400);
    expect(unknown.body.errors.shippingChannelIds).toBe('Unknown shipping channel.');
  });

  it('replaces the shipping channels, and the previous set is removed', async () => {
    await putMe(aliceToken, { ...(await validBody()), shippingChannelIds: [String(jnt)] }).expect(200);

    const links = await prisma.shopShippingChannel.findMany({ where: { shop: { slug: 'alice-farm' } } });
    expect(links.map((link) => link.shippingChannelId)).toEqual([jnt]);
  });

  it('returns 400 with errors.phone for a phone with a space', async () => {
    const res = await putMe(aliceToken, { ...(await validBody()), phone: '+62 812' });

    expect(res.status).toBe(400);
    expect(res.body.errors.phone).toBe('Invalid phone number format.');
  });

  it('clears the phone when it is null', async () => {
    const res = await putMe(aliceToken, { ...(await validBody()), phone: null });

    expect(res.status).toBe(200);
    expect(res.body.shop.phone).toBeNull();
  });

  it('keeps the current zip code and description when they are omitted', async () => {
    const { zipCode, description, ...body } = await validBody();
    expect([zipCode, description]).toHaveLength(2);

    const res = await putMe(aliceToken, body);

    expect(res.status).toBe(200);
    expect(res.body.shop.zipCode).toBe('12110');
    expect(res.body.shop.description).toBe('A fixture shop.');
  });

  it('returns 400 for a zip code that is not 5 digits', async () => {
    const res = await putMe(aliceToken, { ...(await validBody()), zipCode: '1234' });

    expect(res.status).toBe(400);
    expect(res.body.errors.zipCode).toEqual(expect.any(String));
  });

  it('returns 400 for a name that is too short or too long, and a description that is too long', async () => {
    const base = await validBody();

    const short = await putMe(aliceToken, { ...base, name: 'ab' });
    const long = await putMe(aliceToken, { ...base, name: 'x'.repeat(51) });
    const description = await putMe(aliceToken, { ...base, description: 'x'.repeat(2001) });

    expect(short.body.errors.name).toEqual(expect.any(String));
    expect(long.body.errors.name).toEqual(expect.any(String));
    expect(description.body.errors.description).toEqual(expect.any(String));
  });

  it('returns 400 for an unknown field, including a slug or owner', async () => {
    const slug = await putMe(aliceToken, { ...(await validBody()), slug: 'hijacked' });
    const owner = await putMe(aliceToken, { ...(await validBody()), ownerId: 2 });
    const logo = await putMe(aliceToken, { ...(await validBody()), logoUrl: 'http://x/y.png' });

    for (const res of [slug, owner, logo]) {
      expect(res.status).toBe(400);
    }
    expect(slug.body.errors.slug).toEqual(expect.any(String));
    expect((await shopRow('alice-farm')).slug).toBe('alice-farm');
  });

  it('returns 404 for a user who owns no shop, and changes no shop', async () => {
    const before = await shopRow('alice-farm');

    const res = await putMe(bobToken, await validBody());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Shop not found.' });
    expect(await shopRow('alice-farm')).toEqual(before);
    expect((await shopRow('shop-b')).name).toBe('Shop B');
  });

  it("does not change another owner's shop", async () => {
    await createOwnedShop({ slug: 'bob-store', name: 'Bob Store', ownerUsername: 'bob' });
    const before = await shopRow('bob-store');

    await putMe(aliceToken, await validBody()).expect(200);

    expect(await shopRow('bob-store')).toEqual(before);
  });

  it('returns 429 after 20 requests per minute for one user', async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await putMe(aliceToken, {})).status;
    }

    expect(last).toBe(429);
  });
});

describe('PUT /api/shops/me with wilayah.id codes', () => {
  it('saves a 10 digit sub-district code and the city name from wilayah.id', async () => {
    const res = await putMe(aliceToken, {
      ...(await validBody()),
      provinceId: '31',
      cityId: '3171',
      districtId: '317107',
      subDistrictId: '3171071001',
    });

    expect(res.status).toBe(200);
    expect(res.body.shop).toMatchObject({ provinceId: '31', cityId: '3171', districtId: '317107', subDistrictId: '3171071001' });
    expect((await shopRow('alice-farm')).city).toBe('Kota Administrasi Jakarta Pusat');
  });

  it('rejects a city code that does not start with the province code', async () => {
    const res = await putMe(aliceToken, { ...(await validBody()), provinceId: '31', cityId: '3273' });

    expect(res.status).toBe(400);
    expect(res.body.errors.cityId).toBe('This city is not in the selected province.');
  });
});
