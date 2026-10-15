import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { registerAndLogin, resetDatabase, seedTestRegions } from '../helpers/db.js';

// Two users: alice (alice@example.com) and bob (bob@example.com).
let app: ReturnType<typeof createApp>;
let token: string;
let bobToken: string;

beforeEach(async () => {
  await resetDatabase();
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

const validBody = {
  name: 'Alice Wonder',
  username: 'alice',
  email: 'alice@example.com',
  phone: '+6281234567890',
};

function getProfile(authToken: string) {
  return request(app).get('/api/profile').set('Authorization', `Bearer ${authToken}`);
}

function putProfile(authToken: string, body: unknown) {
  return request(app).put('/api/profile').set('Authorization', `Bearer ${authToken}`).send(body as object);
}

describe('GET /api/profile', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/profile');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
  });

  it('returns the profile with address null for a user with no address', async () => {
    const res = await getProfile(token);

    expect(res.status).toBe(200);
    // Register sets the name to the username.
    expect(res.body).toEqual({
      user: { username: 'alice', name: 'alice', email: 'alice@example.com', phone: null, photoUrl: null },
      address: null,
    });
  });

  it('reads the username and email from the database, not from the token', async () => {
    await prisma.user.update({
      where: { usernameLower: 'alice' },
      data: { username: 'Alice_New', usernameLower: 'alice_new', email: 'new@example.com' },
    });

    const res = await getProfile(token);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'Alice_New', email: 'new@example.com' });
  });

  it('does not contain the user id, the password hash or timestamps anywhere', async () => {
    const res = await getProfile(token);
    const text = JSON.stringify(res.body);

    expect(text).not.toMatch(/userId|user_id|passwordHash|password_hash|createdAt|updatedAt|"id"/);
    expect(text).not.toContain('$2');
  });

  it("does not return another user's data", async () => {
    const res = await getProfile(token);

    expect(JSON.stringify(res.body)).not.toContain('bob');
  });
});

describe('PUT /api/profile', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/profile').send(validBody);

    expect(res.status).toBe(401);
  });

  it('updates the profile and returns the full profile', async () => {
    const res = await putProfile(token, {
      name: ' Alice Wonder ',
      username: 'alice_w',
      email: 'alice.w@example.com',
      phone: '+6281234567890',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        username: 'alice_w',
        name: 'Alice Wonder',
        email: 'alice.w@example.com',
        phone: '+6281234567890',
        photoUrl: null,
      },
      address: null,
    });
    expect((await getProfile(token)).body).toEqual(res.body);
  });

  it("succeeds with the user's own current username and email", async () => {
    const res = await putProfile(token, { ...validBody, name: 'Only the name changed' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'alice', email: 'alice@example.com', name: 'Only the name changed' });
  });

  it('lets the user change only the letter case of their own username', async () => {
    const res = await putProfile(token, { ...validBody, username: 'ALICE' });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('ALICE');
  });

  it("returns 409 with field username for another user's username", async () => {
    const res = await putProfile(token, { ...validBody, username: 'bob' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'This username is already taken.', field: 'username' });
  });

  it('returns 409 for a username that differs only in letter case', async () => {
    const res = await putProfile(token, { ...validBody, username: 'BoB' });

    expect(res.status).toBe(409);
    expect(res.body.field).toBe('username');
  });

  it("returns 409 with field email for another user's email, in any letter case", async () => {
    const res = await putProfile(token, { ...validBody, email: 'BOB@Example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'This email is already used.', field: 'email' });
  });

  it('returns the username error when both are taken', async () => {
    const res = await putProfile(token, { ...validBody, username: 'bob', email: 'bob@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.field).toBe('username');
  });

  it('stores an upper case email in lowercase', async () => {
    const res = await putProfile(token, { ...validBody, email: 'Alice.Upper@Example.COM' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice.upper@example.com');
    const stored = await prisma.user.findUniqueOrThrow({ where: { usernameLower: 'alice' }, select: { email: true } });
    expect(stored.email).toBe('alice.upper@example.com');
  });

  it('returns 400 with errors.phone for a phone with a space', async () => {
    const res = await putProfile(token, { ...validBody, phone: '+62 812' });

    expect(res.status).toBe(400);
    expect(res.body.errors.phone).toBe('Invalid phone number format.');
  });

  it('clears the phone when it is null', async () => {
    await putProfile(token, validBody).expect(200);

    const res = await putProfile(token, { ...validBody, phone: null });

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBeNull();
    expect((await getProfile(token)).body.user.phone).toBeNull();
  });

  it('returns 400 for an unknown field', async () => {
    const res = await putProfile(token, { ...validBody, photoUrl: 'http://x/y.jpg' });

    expect(res.status).toBe(400);
    expect(res.body.errors.photoUrl).toEqual(expect.any(String));
  });

  it('returns 400 for a name longer than 50 characters, and for missing fields', async () => {
    const long = await putProfile(token, { ...validBody, name: 'x'.repeat(51) });
    const missing = await putProfile(token, {});

    expect(long.status).toBe(400);
    expect(long.body.errors.name).toEqual(expect.any(String));
    expect(Object.keys(missing.body.errors).sort()).toEqual(['email', 'name', 'phone', 'username']);
  });

  it('lets only one of two parallel updates claim the same new username', async () => {
    const [first, second] = await Promise.all([
      putProfile(token, { ...validBody, username: 'shared_name' }),
      putProfile(bobToken, { ...validBody, email: 'bob@example.com', username: 'shared_name' }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body).toEqual({ message: 'This username is already taken.', field: 'username' });
    expect(await prisma.user.count({ where: { usernameLower: 'shared_name' } })).toBe(1);
  });

  it('lets only one of two parallel updates claim the same new email', async () => {
    const [first, second] = await Promise.all([
      putProfile(token, { ...validBody, email: 'shared@example.com' }),
      putProfile(bobToken, { ...validBody, username: 'bob', email: 'shared@example.com' }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await prisma.user.count({ where: { email: 'shared@example.com' } })).toBe(1);
  });

  it('keeps an old token working after the username changes', async () => {
    await putProfile(token, { ...validBody, username: 'alice_renamed' }).expect(200);

    const res = await getProfile(token);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice_renamed');
  });

  it("does not change the other user's profile", async () => {
    const before = await getProfile(bobToken);

    await putProfile(token, { ...validBody, name: 'Changed', phone: '081234567890' }).expect(200);

    expect((await getProfile(bobToken)).body).toEqual(before.body);
  });

  it('returns 429 after 20 requests per minute for one user', async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await putProfile(token, {})).status;
    }

    expect(last).toBe(429);
  });
});

describe('register and the migration', () => {
  it('gives a new user a name equal to the username', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { usernameLower: 'bob' }, select: { name: true } });

    expect(user.name).toBe('bob');
  });

  it('backfills name from username before making the column required', () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20261017000000_user_profile_and_address/migration.sql'),
      'utf8',
    );

    const backfill = sql.indexOf('UPDATE "users" SET "name" = "username"');
    const required = sql.indexOf('ALTER COLUMN "name" SET NOT NULL');
    expect(backfill).toBeGreaterThan(-1);
    expect(required).toBeGreaterThan(backfill);
  });
});
