import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, UnauthorizedError } from '../../src/lib/errors.js';
import { verifyToken } from '../../src/lib/token.js';

// In-memory stand-in for the repository, so these tests need no database.
// It behaves like the real one: lookups use the lowercase username and the lowercase email.
const { users, fakeRepository } = vi.hoisted(() => {
  interface FakeUser {
    id: number;
    username: string;
    usernameLower: string;
    email: string;
    passwordHash: string;
  }
  const users: FakeUser[] = [];
  const fakeRepository = {
    findById: async (id: number) => users.find((u) => u.id === id) ?? null,
    findByUsernameLower: async (usernameLower: string) =>
      users.find((u) => u.usernameLower === usernameLower) ?? null,
    findByEmail: async (email: string) => users.find((u) => u.email === email) ?? null,
    create: async (data: Omit<FakeUser, 'id'>) => {
      const user = { id: users.length + 1, ...data };
      users.push(user);
      return user;
    },
  };
  return { users, fakeRepository };
});

vi.mock('../../src/repositories/user.repository.js', () => ({ userRepository: fakeRepository }));

const { authService } = await import('../../src/services/auth.service.js');

const validInput = { username: 'Alice_01', email: 'alice@example.com', password: 'secret123' };

beforeEach(() => {
  users.length = 0;
});

describe('authService.register', () => {
  it('creates a user with a hashed password and never stores plain text', async () => {
    const result = await authService.register(validInput);

    expect(result).toEqual({ user_id: 1, username: 'Alice_01', email: 'alice@example.com' });

    const stored = users[0];
    expect(stored?.passwordHash).not.toBe(validInput.password);
    expect(stored?.passwordHash).not.toContain(validInput.password);
    expect(await bcrypt.compare(validInput.password, stored?.passwordHash ?? '')).toBe(true);
    expect(bcrypt.getRounds(stored?.passwordHash ?? '')).toBe(12);
  });

  it('throws a conflict for a taken username', async () => {
    await authService.register(validInput);

    const error = await authService
      .register({ ...validInput, email: 'other@example.com' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).field).toBe('username');
  });

  it('throws a conflict for a username in different letter case', async () => {
    await authService.register(validInput);

    const error = await authService
      .register({ ...validInput, username: 'ALICE_01', email: 'other@example.com' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).field).toBe('username');
  });

  it('throws a conflict for a taken email', async () => {
    await authService.register(validInput);

    const error = await authService
      .register({ ...validInput, username: 'someone_else' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).field).toBe('email');
  });

  it('reports the username when both username and email are taken', async () => {
    await authService.register(validInput);

    const error = await authService.register(validInput).catch((e: unknown) => e);

    expect((error as ConflictError).field).toBe('username');
  });
});

describe('authService.login', () => {
  beforeEach(async () => {
    await authService.register(validInput);
  });

  it('succeeds with correct credentials, ignoring username case', async () => {
    const result = await authService.login({ username: 'alice_01', password: 'secret123' });

    expect(result.user).toEqual({ user_id: 1, username: 'Alice_01', email: 'alice@example.com' });
    expect(typeof result.access_token).toBe('string');
  });

  it('fails with the same error for an unknown user and a wrong password', async () => {
    const unknownUser = await authService
      .login({ username: 'nobody', password: 'secret123' })
      .catch((e: unknown) => e);
    const wrongPassword = await authService
      .login({ username: 'Alice_01', password: 'wrong-password1' })
      .catch((e: unknown) => e);

    expect(unknownUser).toBeInstanceOf(UnauthorizedError);
    expect(wrongPassword).toBeInstanceOf(UnauthorizedError);
    expect((unknownUser as Error).message).toBe('Invalid username or password.');
    expect((wrongPassword as Error).message).toBe((unknownUser as Error).message);
  });

  it('returns a token that can be verified', async () => {
    const { access_token } = await authService.login({
      username: 'Alice_01',
      password: 'secret123',
    });

    expect(verifyToken(access_token)).toEqual({ id: 1, username: 'Alice_01' });
  });
});
