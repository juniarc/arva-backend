import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseBody, parseParams, parseQuery } from '../middleware/validate.js';
import {
  createShopSchema,
  shopParamsSchema,
  shopProductsQuerySchema,
  shopSearchQuerySchema,
  updateOwnerShopSchema,
} from '../schemas/shop.schema.js';
import { shopSearchService } from '../services/shop-search.service.js';
import { shopService } from '../services/shop.service.js';

// These responses depend on who is asking (isOwner, ownerDetails, manage), so no cache may
// keep them and show them to someone else.
function noStore(res: Response): void {
  res.set('Cache-Control', 'private, no-store');
}

// requireAuth sets req.user for the owner endpoints. The user id always comes from the verified token.
function getUserId(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError('Please log in.');
  }
  return req.user.id;
}

async function getBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = parseParams(shopParamsSchema, req);
  noStore(res);
  // optionalAuth sets req.user only for a valid token. Everyone else is a guest.
  const shop = await shopService.getPublicShop(slug, req.user?.id);
  res.status(200).json({ shop });
}

async function getProducts(req: Request, res: Response): Promise<void> {
  const { slug } = parseParams(shopParamsSchema, req);
  const query = parseQuery(shopProductsQuerySchema, req);
  noStore(res);
  res.status(200).json(await shopService.getShopProducts(slug, req.user?.id, query));
}

async function getOwnerShop(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.status(200).json({ shop: await shopService.getOwnerShop(getUserId(req)) });
}

async function createShop(req: Request, res: Response): Promise<void> {
  const input = parseBody(createShopSchema, req);
  noStore(res);
  res.status(201).json({ shop: await shopService.createShop(getUserId(req), input) });
}

async function updateOwnerShop(req: Request, res: Response): Promise<void> {
  const input = parseBody(updateOwnerShopSchema, req);
  noStore(res);
  res.status(200).json({ shop: await shopService.updateOwnerShop(getUserId(req), input) });
}

// GET /shops?q=: public search by shop name or city.
async function search(req: Request, res: Response): Promise<void> {
  const query = parseQuery(shopSearchQuerySchema, req);
  res.status(200).json(await shopSearchService.searchShops(query));
}

export const shopController = { getBySlug, getProducts, getOwnerShop, createShop, updateOwnerShop, search };
