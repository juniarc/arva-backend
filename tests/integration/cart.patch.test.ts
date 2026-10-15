import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { createCartRow, registerAndLogin, resetDatabase, seedFixtures, type Fixtures } from '../helpers/db.js';

let app: ReturnType<typeof createApp>;
let fixtures: Fixtures;
let token: string;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  // A fresh app gives fresh rate-limit counters.
  app = createApp();
  token = await registerAndLogin(app, 'alice');
  await registerAndLogin(app, 'bob');
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function variantId(key: string): number {
  return fixtures.variantIds[key] ?? 0;
}

function patchItem(authToken: string, itemId: number | string, body: unknown) {
  return request(app)
    .patch(`/api/cart/items/${itemId}`)
    .set('Authorization', `Bearer ${authToken}`)
    .send(body as object);
}

async function quantityOf(itemId: number): Promise<number | undefined> {
  const item = await prisma.cartItem.findUnique({ where: { id: itemId }, select: { quantity: true } });
  return item?.quantity;
}

describe('PATCH /api/cart/items/:id', () => {
  it('returns 401 without a token', async () => {
    const itemId = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 1);

    const res = await request(app).patch(`/api/cart/items/${itemId}`).send({ quantity: 2 });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
  });

  it('changes the quantity and returns the full cart with the new subtotal', async () => {
    const itemId = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 1);

    const res = await patchItem(token, itemId, { quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: String(itemId), quantity: 5 });
    expect(res.body.itemCount).toBe(5);
    expect(res.body.subtotal).toBe(5 * 1000);
  });

  it('can lower the quantity', async () => {
    const itemId = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 8);

    const res = await patchItem(token, itemId, { quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(2);
  });

  it('returns 400 for quantity 0 and points to DELETE', async () => {
    const itemId = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 2);

    const res = await patchItem(token, itemId, { quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.errors.quantity).toContain('DELETE /api/cart/items');
    expect(await quantityOf(itemId)).toBe(2);
  });

  it('returns 400 for quantity 100', async () => {
    const itemId = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 2);

    const res = await patchItem(token, itemId, { quantity: 100 });

    expect(res.status).toBe(400);
    expect(res.body.errors.quantity).toEqual(expect.any(String));
  });

  it('returns 400 for a missing, fractional or non-number quantity', async () => {
    const itemId = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 2);

    for (const body of [{}, { quantity: 1.5 }, { quantity: '3' }]) {
      const res = await patchItem(token, itemId, body);
      expect(res.status).toBe(400);
      expect(res.body.errors.quantity).toEqual(expect.any(String));
    }
  });

  it('returns 400 for an unknown field in the body', async () => {
    const itemId = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 2);

    const res = await patchItem(token, itemId, { quantity: 3, userId: 999 });

    expect(res.status).toBe(400);
    expect(res.body.errors.userId).toEqual(expect.any(String));
    expect(await quantityOf(itemId)).toBe(2);
  });

  it('returns 400 for an id that is not numeric', async () => {
    const res = await patchItem(token, 'abc', { quantity: 2 });

    expect(res.status).toBe(400);
    expect(res.body.errors.id).toEqual(expect.any(String));
  });

  it('returns 409 INSUFFICIENT_STOCK when the quantity is above the stock', async () => {
    const itemId = await createCartRow('alice', variantId('sprayer/2 L'), 1);

    const res = await patchItem(token, itemId, { quantity: 4 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Only 3 left in stock.', code: 'INSUFFICIENT_STOCK' });
    expect(await quantityOf(itemId)).toBe(1);
  });

  it('returns 409 OUT_OF_STOCK for a zero-stock variant', async () => {
    const itemId = await createCartRow('alice', variantId('mango/1 kg'), 1);

    const res = await patchItem(token, itemId, { quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'This variant is out of stock.', code: 'OUT_OF_STOCK' });
  });

  it("returns 404 for another user's item and does not change it", async () => {
    const bobItem = await createCartRow('bob', variantId('bali-banana-fruit/1 kg'), 2);

    const res = await patchItem(token, bobItem, { quantity: 5 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Cart item not found.' });
    expect(await quantityOf(bobItem)).toBe(2);
  });

  it('returns the same 404 for an item that does not exist', async () => {
    const res = await patchItem(token, 999999, { quantity: 2 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Cart item not found.' });
  });

  it('returns 404 when the product is inactive', async () => {
    const itemId = await createCartRow('alice', variantId('hidden/1 kg'), 1);

    const res = await patchItem(token, itemId, { quantity: 2 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Cart item not found.' });
    expect(await quantityOf(itemId)).toBe(1);
  });

  it('does not touch the other user\'s cart', async () => {
    const aliceItem = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 1);
    const bobItem = await createCartRow('bob', variantId('bali-banana-fruit/1 kg'), 2);

    await patchItem(token, aliceItem, { quantity: 6 }).expect(200);

    expect(await quantityOf(bobItem)).toBe(2);
  });

  it('lets only one of two parallel updates that cannot both fit the stock succeed', async () => {
    // Stock is 3. One request wants 2 and the other wants 4, so only the first fits.
    const itemId = await createCartRow('alice', variantId('sprayer/2 L'), 1);

    const [fits, tooMany] = await Promise.all([
      patchItem(token, itemId, { quantity: 2 }),
      patchItem(token, itemId, { quantity: 4 }),
    ]);

    expect(fits.status).toBe(200);
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.code).toBe('INSUFFICIENT_STOCK');
    expect(await quantityOf(itemId)).toBe(2);
  });

  it('never leaves a quantity above the stock when parallel updates race', async () => {
    const itemId = await createCartRow('alice', variantId('sprayer/2 L'), 1);

    const results = await Promise.all(
      [2, 3, 4, 5, 6].map((quantity) => patchItem(token, itemId, { quantity })),
    );

    expect(results.map((res) => res.status).filter((status) => status === 200).length).toBeGreaterThanOrEqual(1);
    expect(results.every((res) => res.status === 200 || res.status === 409)).toBe(true);
    expect(await quantityOf(itemId)).toBeLessThanOrEqual(3);
  });
});
