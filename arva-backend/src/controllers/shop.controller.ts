import type { Request, Response } from 'express';
import { parseParams } from '../middleware/validate.js';
import { shopParamsSchema } from '../schemas/shop.schema.js';
import { shopService } from '../services/shop.service.js';

async function getBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = parseParams(shopParamsSchema, req);
  const shop = await shopService.getShopProfile(slug);
  res.status(200).json({ shop });
}

export const shopController = { getBySlug };
