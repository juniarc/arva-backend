import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyToken } from '../lib/token.js';

// Expects "Authorization: Bearer <token>". On success it sets req.user.
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const [scheme, token] = header?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedError('Please log in.');
  }

  req.user = verifyToken(token);
  next();
}
