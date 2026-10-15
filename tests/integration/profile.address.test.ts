import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  createCartRow,
  regionId,
  registerAndLogin,
  resetDatabase,
  seedFixtures,
  seedTestRegions,
  type Fixtures,
} from '../helpers/db.js';

let app: ReturnType<typeof createApp>;
let fixtures: Fixtures;
let token: string;
let bobToken: string;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  await seedTestRegions();
  // A fresh app gives fresh rate-limit counters.
  app = createApp();
  token = await registerAndLogin(app, 'alice');
  bobToken = await registerAndLogin(app, 'bob');
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function putAddress(authToken: string, body: unknown) {
  return request(app).put('/api/profile/address').set('Authorization', `Bearer ${authToken}`).send(body as object);
}

function getProfile(authToken: string) {
  return request(app).get('/api/profile').set('Authorization', `Bearer ${authToken}`);
}

async function jakartaAddress() {
  return {
    street: 'Jl. Mawar No. 1',
    subDistrict: { id: String(await regionId('subDistrict', 'Gunung')) },
    district: { id: String(await regionId('district', 'Kebayoran Baru')) },
    city: { id: String(await regionId('city', 'Kota Administrasi Jakarta Selatan')) },
    province: { id: String(await regionId('province', 'DKI Jakarta')) },
    zipCode: '12110',
  };
}

async function baliAddress() {
  return {
    street: 'Jl. Pantai 9',
    subDistrict: { id: String(await regionId('subDistrict', 'Sanur')) },
    district: { id: String(await regionId('district', 'Denpasar Selatan')) },
    city: { id: String(await regionId('city', 'Kota Denpasar')) },
    province: { id: String(await regionId('province', 'Bali')) },
    zipCode: '80228',
  };
}

describe('PUT /api/profile/address', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/profile/address').send(await jakartaAddress());

    expect(res.status).toBe(401);
  });

  it('creates the address, and GET shows it', async () => {
    const res = await putAddress(token, { ...(await jakartaAddress()), street: '  Jl. Mawar No. 1  ' });

    expect(res.status).toBe(200);
    const expected = {
      street: 'Jl. Mawar No. 1',
      subDistrict: { id: expect.any(String), name: 'Gunung' },
      district: { id: expect.any(String), name: 'Kebayoran Baru' },
      city: { id: expect.any(String), name: 'Kota Administrasi Jakarta Selatan' },
      province: { id: expect.any(String), name: 'DKI Jakarta' },
      zipCode: '12110',
    };
    expect(res.body.address).toEqual(expected);
    expect(res.body.user.username).toBe('alice');
    expect((await getProfile(token)).body.address).toEqual(expected);
  });

  it('replaces the address on a second save, and keeps exactly one row', async () => {
    await putAddress(token, await jakartaAddress()).expect(200);

    const res = await putAddress(token, await baliAddress());

    expect(res.status).toBe(200);
    expect(res.body.address).toMatchObject({ street: 'Jl. Pantai 9', zipCode: '80228', city: { name: 'Kota Denpasar' } });
    const user = await prisma.user.findUniqueOrThrow({ where: { usernameLower: 'alice' }, select: { id: true } });
    expect(await prisma.userAddress.count({ where: { userId: user.id } })).toBe(1);
  });

  it('keeps one row when two saves run at the same time', async () => {
    const [first, second] = await Promise.all([
      putAddress(token, await jakartaAddress()),
      putAddress(token, await baliAddress()),
    ]);

    // The upsert is keyed on the unique user id, so neither request fails.
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await prisma.userAddress.count()).toBe(1);
  });

  it('returns 400 with errors.city for a city from another province', async () => {
    const res = await putAddress(token, {
      ...(await jakartaAddress()),
      city: { id: String(await regionId('city', 'Kota Bandung')) },
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.city).toBe('This city is not in the selected province.');
    expect((await getProfile(token)).body.address).toBeNull();
  });

  it('returns 400 for a district or sub-district from the wrong parent', async () => {
    const base = await jakartaAddress();

    const district = await putAddress(token, { ...base, district: { id: String(await regionId('district', 'Cicendo')) } });
    const subDistrict = await putAddress(token, {
      ...base,
      subDistrict: { id: String(await regionId('subDistrict', 'Sanur')) },
    });

    expect(district.body.errors.district).toBe('This district is not in the selected city.');
    expect(subDistrict.body.errors.subDistrict).toBe('This sub-district is not in the selected district.');
  });

  it.each(['1234', '12a45', '123456', '12 45', ''])('returns 400 with errors.zipCode for "%s"', async (zipCode) => {
    const res = await putAddress(token, { ...(await jakartaAddress()), zipCode });

    expect(res.status).toBe(400);
    expect(res.body.errors.zipCode).toEqual(expect.any(String));
  });

  it('returns 400, not 404, for a region id that does not exist', async () => {
    const res = await putAddress(token, { ...(await jakartaAddress()), province: { id: '99999' } });

    expect(res.status).toBe(400);
    expect(res.body.errors.province).toBe('Province not found.');
  });

  it('returns 400 for a missing field and an unknown field', async () => {
    const { street, ...withoutStreet } = await jakartaAddress();
    expect(street).toBeDefined();

    const missing = await putAddress(token, withoutStreet);
    const extra = await putAddress(token, { ...(await jakartaAddress()), label: 'Home' });

    expect(missing.status).toBe(400);
    expect(missing.body.errors.street).toEqual(expect.any(String));
    expect(extra.status).toBe(400);
    expect(extra.body.errors.label).toEqual(expect.any(String));
  });

  it("does not change the other user's address or profile", async () => {
    await putAddress(bobToken, await baliAddress()).expect(200);
    const before = await getProfile(bobToken);

    await putAddress(token, await jakartaAddress()).expect(200);

    expect((await getProfile(bobToken)).body).toEqual(before.body);
  });

  it('does not change a checkout draft that already exists', async () => {
    const item = await createCartRow('alice', fixtures.variantIds['cucumber/1 kg'] ?? 0, 2);
    await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemIds: [String(item)] })
      .expect(200);
    const before = await request(app).get('/api/checkout').set('Authorization', `Bearer ${token}`);

    await putAddress(token, await jakartaAddress()).expect(200);
    await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', username: 'alice', email: 'alice@example.com', phone: '+6281234567890' })
      .expect(200);

    const after = await request(app).get('/api/checkout').set('Authorization', `Bearer ${token}`);
    expect(after.body).toEqual(before.body);
    expect(after.body.address).toBeNull();
  });
});

describe('PUT /api/profile/address with wilayah.id codes', () => {
  it('saves a 10 digit sub-district code above the 32 bit integer limit', async () => {
    const res = await putAddress(token, {
      street: 'Jl. Gelora 1',
      zipCode: '10270',
      province: { id: '31' },
      city: { id: '3171' },
      district: { id: '317107' },
      subDistrict: { id: '3171071001' },
    });

    expect(res.status).toBe(200);
    expect(res.body.address).toMatchObject({
      subDistrict: { id: '3171071001', name: 'Gelora' },
      district: { id: '317107', name: 'Tanah Abang' },
      city: { id: '3171', name: 'Kota Administrasi Jakarta Pusat' },
      province: { id: '31', name: 'DKI Jakarta' },
    });
  });

  it('rejects a sub-district code that does not start with its district code', async () => {
    const res = await putAddress(token, {
      street: 'Jl. Gelora 1',
      zipCode: '10270',
      province: { id: '31' },
      city: { id: '3171' },
      district: { id: '317107' },
      subDistrict: { id: '3174071002' },
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.subDistrict).toBe('This sub-district is not in the selected district.');
  });

  it('rejects a code longer than 10 digits', async () => {
    const res = await putAddress(token, {
      street: 'Jl. Gelora 1',
      zipCode: '10270',
      province: { id: '31' },
      city: { id: '3171' },
      district: { id: '317107' },
      subDistrict: { id: '31710710011' },
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.subDistrict).toEqual(expect.any(String));
  });
});
