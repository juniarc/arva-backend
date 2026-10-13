import type { Request, Response } from 'express';
import { parseParams, parseQuery } from '../middleware/validate.js';
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

export const productController = { list, getRecommended, getCities, getBySlug, getReviews };
