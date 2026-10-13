import type { Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Limiters are created by functions (not at import time) so each app instance,
// including every test app, starts with an empty counter.

// General limit for every /api/auth route, per IP.
export function createAuthLimiter(): RequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: sendTooManyAttempts,
  });
}

// Login limit: 5 failed attempts per 15 minutes for each IP + username pair.
// Successful logins are not counted.
export function createLoginLimiter(): RequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${readUsername(req)}`,
    handler: sendTooManyAttempts,
  });
}

// Limit for public read endpoints (products, reviews, shops): 120 requests per minute per IP.
export function createPublicReadLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
    },
  });
}

// Add-to-cart limit: 60 requests per minute for each logged-in user.
// Must run after requireAuth, because the key is the user id from the verified token.
export function createCartWriteLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.id ?? ipKeyGenerator(req.ip ?? '')),
    handler: (_req, res) => {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
    },
  });
}

// Checkout write limit (create draft, set address): 30 requests per minute for each logged-in user.
// Must run after requireAuth, like the cart limiter.
export function createCheckoutWriteLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.id ?? ipKeyGenerator(req.ip ?? '')),
    handler: (_req, res) => {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
    },
  });
}

// Profile write limit (update profile, save address): 20 requests per minute for each logged-in user.
// Must run after requireAuth, like the cart limiter.
export function createProfileWriteLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.id ?? ipKeyGenerator(req.ip ?? '')),
    handler: (_req, res) => {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
    },
  });
}

// Shop owner write limit (update shop): 20 requests per minute for each logged-in user.
// Must run after requireAuth, like the cart limiter.
export function createShopWriteLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.id ?? ipKeyGenerator(req.ip ?? '')),
    handler: (_req, res) => {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
    },
  });
}

function readUsername(req: Request): string {
  const body: unknown = req.body;
  if (typeof body === 'object' && body !== null && 'username' in body) {
    const username = body.username;
    if (typeof username === 'string') {
      return username.trim().toLowerCase();
    }
  }
  return '';
}

function sendTooManyAttempts(_req: Request, res: Response): void {
  res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
}
