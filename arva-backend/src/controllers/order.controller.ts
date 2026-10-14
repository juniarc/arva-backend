import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseQuery } from '../middleware/validate.js';
import { orderListQuerySchema } from '../schemas/order.schema.js';
import { orderService } from '../services/order.service.js';

// GET /orders: the logged-in buyer's orders. The user id always comes from the verified token.
async function list(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError('Please log in.');
  }
  const { page, limit } = parseQuery(orderListQuerySchema, req);
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json(await orderService.listOrders(req.user.id, page, limit));
}

export const orderController = { list };
