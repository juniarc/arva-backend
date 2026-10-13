import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { createCartRow, registerAndLogin, resetDatabase, seedFixtures, type Fixtures } from '../helpers/db.js';

let app: ReturnType<typeof createApp>;
let fixtures: Fixtures;
let token: string;
let bobToken: string;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  // A fresh app gives fresh rate-limit counters.
  app = createApp();
  token = await registerAndLogin(app, 'alice');
  bobToken = await registerAndLogin(app, 'bob');
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function variantId(key: string): number {
  return fixtures.variantIds[key] ?? 0;
}

// supertest sets Content-Type: application/json when the body is an object.
function deleteItems(authToken: string, body: unknown) {
  return request(app)
    .delete('/api/cart/items')
    .set('Authorization', `Bearer ${authToken}`)
    .send(body as object);
}

function getCart(authToken: string) {
  return request(app).get('/api/cart').set('Authorization', `Bearer ${authToken}`);
}

describe('DELETE /api/cart/items', () => {
  it('returns 401 without a token', async () => {
    const itemId = await createCartRow('alice', variantId('cucumber/1 kg'), 1);

    const res = await request(app).delete('/api/cart/items').send({ itemIds: [String(itemId)] });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
    expect(await prisma.cartItem.count()).toBe(1);
  });

  it('removes two of the user\'s items and returns the remaining cart', async () => {
    const first = await createCartRow('alice', variantId('cucumber/1 kg'), 1);
    const second = await createCartRow('alice', variantId('sprayer/2 L'), 1);
    const kept = await createCartRow('alice', variantId('bali-banana-fruit/1 kg'), 2);

    const res = await deleteItems(token, { itemIds: [String(first), String(second)] });

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([String(kept)]);
    expect(res.body.itemCount).toBe(2);
    expect(res.body.subtotal).toBe(2000);
    expect(await prisma.cartItem.count({ where: { id: { in: [first, second] } } })).toBe(0);
  });

  it("ignores another user's item id without an error and removes nothing", async () => {
    const aliceItem = await createCartRow('alice', variantId('cucumber/1 kg'), 1);
    const bobItem = await createCartRow('bob', variantId('cucumber/1 kg'), 3);

    const res = await deleteItems(token, { itemIds: [String(bobItem)] });

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([String(aliceItem)]);
    expect(await prisma.cartItem.findUnique({ where: { id: bobItem } })).not.toBeNull();
  });

  it('returns the same answer for an id that does not exist', async () => {
    await createCartRow('alice', variantId('cucumber/1 kg'), 1);

    const res = await deleteItems(token, { itemIds: ['999999'] });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('removes an item once when its id is sent several times', async () => {
    const itemId = await createCartRow('alice', variantId('cucumber/1 kg'), 1);
    await createCartRow('alice', variantId('sprayer/2 L'), 1);

    const res = await deleteItems(token, { itemIds: [String(itemId), String(itemId), String(itemId)] });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('can remove an item of an inactive product', async () => {
    const hidden = await createCartRow('alice', variantId('hidden/1 kg'), 1);

    await deleteItems(token, { itemIds: [String(hidden)] }).expect(200);

    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('returns 400 for an empty itemIds array', async () => {
    const res = await deleteItems(token, { itemIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.errors.itemIds).toEqual(expect.any(String));
  });

  it('returns 400 for more than 100 ids', async () => {
    const itemIds = Array.from({ length: 101 }, (_, index) => String(index + 1));

    const res = await deleteItems(token, { itemIds });

    expect(res.status).toBe(400);
    expect(res.body.errors.itemIds).toEqual(expect.any(String));
  });

  it('accepts exactly 100 ids', async () => {
    const itemIds = Array.from({ length: 100 }, (_, index) => String(index + 1));

    const res = await deleteItems(token, { itemIds });

    expect(res.status).toBe(200);
  });

  it('returns 400 with errors.itemIds for a non-numeric id', async () => {
    const res = await deleteItems(token, { itemIds: ['12', 'abc'] });

    expect(res.status).toBe(400);
    expect(res.body.errors.itemIds).toEqual(expect.any(String));
  });

  it('returns 400 when itemIds is missing, not an array, or holds numbers', async () => {
    for (const body of [{}, { itemIds: '12' }, { itemIds: [12] }]) {
      const res = await deleteItems(token, body);
      expect(res.status).toBe(400);
      expect(res.body.errors.itemIds).toEqual(expect.any(String));
    }
  });

  it('returns 400 for an unknown field in the body', async () => {
    const res = await deleteItems(token, { itemIds: ['1'], userId: 2 });

    expect(res.status).toBe(400);
    expect(res.body.errors.userId).toEqual(expect.any(String));
  });

  it("leaves the other user's cart unchanged", async () => {
    const aliceItem = await createCartRow('alice', variantId('cucumber/1 kg'), 1);
    await createCartRow('bob', variantId('sprayer/2 L'), 2);
    const before = await getCart(bobToken);

    await deleteItems(token, { itemIds: [String(aliceItem)] }).expect(200);

    const after = await getCart(bobToken);
    expect(after.body).toEqual(before.body);
    expect(after.body.items).toHaveLength(1);
  });
});
