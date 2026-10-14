import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseParams, parseQuery, parseWith } from '../middleware/validate.js';
import {
  createProductSchema,
  ownedProductParamsSchema,
  parseProductData,
  updateProductSchema,
} from '../schemas/product-create.schema.js';
import { productCreateService } from '../services/product-create.service.js';
import { productManageService } from '../services/product-manage.service.js';
import {
  productListQuerySchema,
  productSlugParamsSchema,
  recommendedQuerySchema,
} from '../schemas/product.schema.js';
import { reviewListQuerySchema } from '../schemas/review.schema.js';
import { productCityService } from '../services/product-city.service.js';
import { productService } from '../services/product.service.js';

async function list(req: Request, res: Response): Promise<void> {
  const query = parseQuery(productListQuerySchema, req);
  res.status(200).json(await productService.listProducts(query));
}

async function getRecommended(req: Request, res: Response): Promise<void> {
  const query = parseQuery(recommendedQuerySchema, req);
  res.status(200).json(await productService.getRecommended(query));
}

async function getCities(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await productCityService.getCities());
}

async function getBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = parseParams(productSlugParamsSchema, req);
  const product = await productService.getProductDetail(slug);
  res.status(200).json({ product });
}

async function getReviews(req: Request, res: Response): Promise<void> {
  const { slug } = parseParams(productSlugParamsSchema, req);
  const query = parseQuery(reviewListQuerySchema, req);
  res.status(200).json(await productService.getProductReviews(slug, query));
}

// requireAuth sets req.user. The user id always comes from the verified token.
function getUserId(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError('Please log in.');
  }
  return req.user.id;
}

// productUpload has read the multipart body: the JSON is in the text field "data".
function readData(req: Request): unknown {
  const body: unknown = req.body;
  const raw = typeof body === 'object' && body !== null && 'data' in body ? body.data : undefined;
  return parseProductData(raw) ?? {};
}

function uploadedFiles(req: Request): Express.Multer.File[] {
  return Array.isArray(req.files) ? req.files : [];
}

// POST /products: the JSON in "data" and the photos in "images".
async function create(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const input = parseWith(createProductSchema, readData(req));
  res.set('Cache-Control', 'private, no-store');
  res.status(201).json({ product: await productCreateService.createProduct(userId, input, uploadedFiles(req)) });
}

// GET /products/mine/:id: one of the user's own products, for the edit form.
async function getOwned(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { id } = parseParams(ownedProductParamsSchema, req);
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({ product: await productManageService.getOwnedProduct(userId, Number(id)) });
}

// PUT /products/mine/:id: the same multipart body as POST, plus keepImageIds and variant ids.
async function update(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { id } = parseParams(ownedProductParamsSchema, req);
  const input = parseWith(updateProductSchema, readData(req));
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({ product: await productManageService.updateProduct(userId, Number(id), input, uploadedFiles(req)) });
}

// DELETE /products/mine/:id: removes the product completely.
async function remove(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { id } = parseParams(ownedProductParamsSchema, req);
  await productManageService.deleteProduct(userId, Number(id));
  res.status(204).end();
}

export const productController = { list, getRecommended, getCities, getBySlug, getReviews, create, getOwned, update, remove };
