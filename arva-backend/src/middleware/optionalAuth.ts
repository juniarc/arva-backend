import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/token.js';

// Like requireAuth, but it never fails the request. With a valid "Authorization: Bearer <token>"
// it sets req.user. With no token, or a bad or expired one, the request carries on as a guest.
// Only owner-only fields depend on the result, so a guest simply does not get them.
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];

  if (scheme?.toLowerCase() === 'bearer' && token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // Treated as a guest. The token is not logged.
    }
  }
  next();
}
