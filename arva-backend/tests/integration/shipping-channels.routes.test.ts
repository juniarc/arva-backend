import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase, seedTestChannels } from '../helpers/db.js';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
  await seedTestChannels();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('GET /api/shipping-channels', () => {
  it('returns the seeded channels in sort order, without a token', async () => {
    const res = await request(app).get('/api/shipping-channels');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        { id: expect.any(String), name: 'JNE' },
        { id: expect.any(String), name: 'J&T Express' },
      ],
    });
  });

  it('orders by sort order, then by name', async () => {
    await prisma.shippingChannel.create({ data: { name: 'Aaa Cargo', sortOrder: 1 } });
    await prisma.shippingChannel.create({ data: { name: 'Last One', sortOrder: 9 } });

    const res = await request(app).get('/api/shipping-channels');

    expect(res.body.items.map((item: { name: string }) => item.name)).toEqual([
      'Aaa Cargo',
      'JNE',
      'J&T Express',
      'Last One',
    ]);
  });

  it('can be seeded twice without duplicating channels', async () => {
    await seedTestChannels();

    expect(await prisma.shippingChannel.count()).toBe(2);
  });

  it('returns only id and name', async () => {
    const res = await request(app).get('/api/shipping-channels');

    expect(Object.keys(res.body.items[0]).sort()).toEqual(['id', 'name']);
  });
});
