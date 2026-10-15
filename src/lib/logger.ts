import pino from 'pino';
import { env } from './env.js';

// Defensive: if someone ever logs an object that holds these fields, they are masked.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'access_token',
      'req.headers.authorization',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.access_token',
    ],
    censor: '[redacted]',
  },
});
