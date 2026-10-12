import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../../src/lib/errors.js';
import { signToken, verifyToken } from '../../src/lib/token.js';

const secret = process.env.JWT_SECRET ?? '';

afterEach(() => {
  vi.useRealTimers();
});

describe('token helpers', () => {
  it('signs a verifiable HS256 token with sub, username, iat and exp', () => {
    const token = signToken({ id: 7, username: 'alice' });
    const decoded = jwt.decode(token, { complete: true });

    expect(decoded?.header.alg).toBe('HS256');
    expect(decoded?.payload).toMatchObject({ sub: '7', username: 'alice' });
    expect(verifyToken(token)).toEqual({ id: 7, username: 'alice' });
  });

  it('expires as configured by JWT_EXPIRES_IN (15m in tests)', () => {
    const token = signToken({ id: 7, username: 'alice' });
    const payload = jwt.decode(token);

    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Expected an object payload');
    }
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(15 * 60);
  });

  it('rejects the token once it has expired', () => {
    vi.useFakeTimers();
    const token = signToken({ id: 7, username: 'alice' });

    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(verifyToken(token).id).toBe(7);

    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(() => verifyToken(token)).toThrow(UnauthorizedError);
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ username: 'alice' }, 'another-secret-that-is-long-enough-123', {
      subject: '7',
      expiresIn: '1h',
    });
    expect(() => verifyToken(forged)).toThrow(UnauthorizedError);
  });

  it('rejects a token without an expiry', () => {
    const noExpiry = jwt.sign({ username: 'alice' }, secret, { subject: '7' });
    expect(() => verifyToken(noExpiry)).toThrow(UnauthorizedError);
  });

  it('rejects an unsigned token (alg "none")', () => {
    const unsigned = jwt.sign({ username: 'alice' }, '', {
      algorithm: 'none',
      subject: '7',
      expiresIn: '1h',
    });
    expect(() => verifyToken(unsigned)).toThrow(UnauthorizedError);
  });

  it('rejects a token signed with another algorithm (HS512)', () => {
    const hs512 = jwt.sign({ username: 'alice' }, secret, {
      algorithm: 'HS512',
      subject: '7',
      expiresIn: '1h',
    });
    expect(() => verifyToken(hs512)).toThrow(UnauthorizedError);
  });
});
