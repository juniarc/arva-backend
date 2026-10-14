import path from 'node:path';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/index.js';

// Logs method, path, status and duration only. Never bodies, query strings or headers.
function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      'request',
    );
  });
  next();
}

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  // The frontend calls this API from its server, so cookies are not needed.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: false }));
  app.use(express.json({ limit: '10kb' }));
  app.use(requestLogger);

  // Uploaded product photos. The frontend runs on another origin, so helmet's default
  // Cross-Origin-Resource-Policy (same-origin) is relaxed for these files only.
  app.use(
    '/uploads',
    (_req: Request, res: Response, next: NextFunction) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(path.resolve(env.UPLOAD_DIR), { index: false, dotfiles: 'deny', maxAge: '7d' }),
  );

  app.use('/api', createApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
