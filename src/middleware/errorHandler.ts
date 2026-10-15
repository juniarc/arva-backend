import type { NextFunction, Request, Response } from 'express';
import {
  ConflictError,
  NotFoundError,
  ShopAlreadyExistsError,
  StockConflictError,
  UnauthorizedError,
  ValidationError,
} from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// Errors raised by express.json() carry a `type` such as "entity.parse.failed".
function getBodyParserErrorType(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const type = error.type;
    return typeof type === 'string' ? type : undefined;
  }
  return undefined;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Not found.' });
}

// The single place where errors become HTTP responses. It never sends stack traces
// or internal messages to the client.
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  // Express only treats a function as an error handler if it takes four arguments.
  _next: NextFunction,
): void {
  if (error instanceof ValidationError) {
    res.status(400).json({ message: error.message, errors: error.errors });
    return;
  }
  if (error instanceof ConflictError) {
    res.status(409).json({ message: error.message, field: error.field });
    return;
  }
  if (error instanceof StockConflictError) {
    res.status(409).json({ message: error.message, code: error.code });
    return;
  }
  if (error instanceof ShopAlreadyExistsError) {
    res.status(409).json({ message: error.message, code: 'SHOP_ALREADY_EXISTS' });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ message: error.message });
    return;
  }
  if (error instanceof UnauthorizedError) {
    res.status(401).json({ message: error.message });
    return;
  }

  const bodyErrorType = getBodyParserErrorType(error);
  if (bodyErrorType === 'entity.too.large') {
    res.status(413).json({ message: 'Request body is too large.' });
    return;
  }
  if (bodyErrorType === 'entity.parse.failed' || bodyErrorType === 'encoding.unsupported') {
    res.status(400).json({ message: 'Request body is not valid JSON.', errors: {} });
    return;
  }

  logger.error({ err: error }, 'Unhandled error');
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}
