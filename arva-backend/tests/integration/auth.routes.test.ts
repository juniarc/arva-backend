import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

const validUser = { username: 'Alice_01', email: 'alice@example.com', password: 'secret123' };

// A fresh app per test gives fresh rate-limit counters.
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await prisma.user.deleteMany();
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAlice(): Promise<void> {
  await request(app).post('/api/auth/register').send(validUser).expect(201);
}

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/auth/register', () => {
  it('returns 201 with the user and no password fields', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user_id: expect.any(Number),
      username: 'Alice_01',
      email: 'alice@example.com',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('stores the password hashed and the email in lowercase', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: '  Alice@Example.COM ' })
      .expect(201);

    const stored = await prisma.user.findFirstOrThrow();
    expect(stored.email).toBe('alice@example.com');
    expect(stored.passwordHash).not.toBe(validUser.password);
  });

  it('returns 409 with field "username" for a duplicate username in different case', async () => {
    await registerAlice();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, username: 'ALICE_01', email: 'other@example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Username is already taken.', field: 'username' });
  });

  it('returns 409 with field "email" for a duplicate email', async () => {
    await registerAlice();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, username: 'someone_else', email: 'ALICE@example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Email is already taken.', field: 'email' });
  });

  it('returns the username error when both are taken', async () => {
    await registerAlice();
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.field).toBe('username');
  });

  it('returns 400 with an errors object for invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a!', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(expect.any(String));
    expect(Object.keys(res.body.errors).sort()).toEqual(['email', 'password', 'username']);
  });

  it('returns 400 for each missing field', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['email', 'password', 'username']);
  });

  it('requires a letter and a number in the password', async () => {
    const noNumber = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: 'onlyletters' });
    const noLetter = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: '1234567890' });

    expect(noNumber.body.errors.password).toMatch(/number/);
    expect(noLetter.body.errors.password).toMatch(/letter/);
  });

  it('returns 400 for malformed JSON and 413 for a body over 10kb', async () => {
    const malformed = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{ not json');
    expect(malformed.status).toBe(400);

    const tooLarge = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, username: 'x'.repeat(11_000) });
    expect(tooLarge.status).toBe(413);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with a token and the user', async () => {
    await registerAlice();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice_01', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      user_id: expect.any(Number),
      username: 'Alice_01',
      email: 'alice@example.com',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('returns the same 401 for a wrong password and an unknown user', async () => {
    await registerAlice();

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Alice_01', password: 'wrong-password1' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'secret123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body).toEqual({ message: 'Invalid username or password.' });
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('returns 400 with an errors object for missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['password', 'username']);
  });

  it('returns 429 after 5 failed attempts for the same username', async () => {
    await registerAlice();
    const attempt = () =>
      request(app).post('/api/auth/login').send({ username: 'Alice_01', password: 'wrong-password1' });

    for (let i = 0; i < 5; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ message: 'Too many login attempts. Please try again later.' });

    // Even the correct password is refused while blocked.
    const correct = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Alice_01', password: 'secret123' });
    expect(correct.status).toBe(429);
  });

  it('does not count successful logins toward the limit', async () => {
    await registerAlice();

    for (let i = 0; i < 7; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'Alice_01', password: 'secret123' })
        .expect(200);
    }
  });
});

describe('GET /api/auth/me', () => {
  async function loginAndGetToken(): Promise<string> {
    await registerAlice();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Alice_01', password: 'secret123' });
    return res.body.access_token as string;
  }

  it('returns the user with a valid token', async () => {
    const token = await loginAndGetToken();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { user_id: expect.any(Number), username: 'Alice_01', email: 'alice@example.com' },
    });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in.' });
  });

  it('returns 401 when the user no longer exists', async () => {
    const token = await loginAndGetToken();
    await prisma.user.deleteMany();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

describe('security headers and unknown routes', () => {
  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not found.' });
  });
});
