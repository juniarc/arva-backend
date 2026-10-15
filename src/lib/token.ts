import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from './env.js';
import { UnauthorizedError } from './errors.js';

const ALGORITHM = 'HS256';

const payloadSchema = z.object({
  sub: z.string().regex(/^\d+$/),
  username: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export interface TokenUser {
  id: number;
  username: string;
}

export function signToken(user: TokenUser): string {
  return jwt.sign({ username: user.username }, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: String(user.id),
    // The env schema guarantees the format (for example "1d"), which the library accepts.
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

// Throws UnauthorizedError for any problem: bad signature, wrong algorithm, expired, no exp.
export function verifyToken(token: string): TokenUser {
  try {
    // Pinning `algorithms` rejects "none" and any other algorithm.
    const decoded: unknown = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
    // The payload schema requires `exp`, so a token without an expiry is rejected.
    const payload = payloadSchema.parse(decoded);
    return { id: Number(payload.sub), username: payload.username };
  } catch {
    throw new UnauthorizedError('Please log in.');
  }
}
