import { NotFoundError, ValidationError } from '../lib/errors.js';
import { toImageUrl } from '../lib/imageUrl.js';
import { calculateDiscountPercent } from '../lib/money.js';
import { buildPagination, type Pagination } from '../lib/pagination.js';
import { tenthsToRating, toShopRating, type ShopRatingResponse } from '../lib/rating.js';
import { categoryRepository } from '../repositories/category.repository.js';
import {
  productRepository,
  type ProductDetailRecord,
  type ProductFilter,
  type ProductListRecord,
} from '../repositories/product.repository.js';
import { reviewRepository, type ReviewRecord } from '../repositories/review.repository.js';
import { shopRepository } from '../repositories/shop.repository.js';
import type { ProductListQuery, RecommendedQuery } from '../schemas/product.schema.js';
import type { ReviewListQuery } from '../schemas/review.schema.js';

export const REVIEW_PREVIEW_LIMIT = 10;

export interface ProductResponse {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  rating: number;
  soldCount: number;
  city: string;
  imageUrl: string;
  shopSlug: string;
  shopName: string;
}

export interface ReviewResponse {
  id: string;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  text: string;
  createdAt: string;
}

export interface ProductDetailResponse {
  id: string;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  soldCount: number;
  rating: { average: number; ratingCount: number; reviewCount: number };
  images: { id: string; url: string; alt: string }[];
  variants: {
    id: string;
    label: string;
    unit: string;
    price: number;
    originalPrice: number | null;
    stock: number;
  }[];
  defaultVariantId: string;
  shop: {
    slug: string;
    name: string;
    city: string;
    logoUrl: string | null;
    rating: ShopRatingResponse;
  };
  reviewPreview: ReviewResponse[];
}

export interface ProductListResponse {
  products: ProductResponse[];
  pagination: Pagination;
}

export interface ReviewListResponse {
  reviews: ReviewResponse[];
  pagination: Pagination;
}

// The "from" variant is the cheapest one. Its price is shown on cards and used for price sorting.
function findLowestPriceVariant(product: ProductListRecord): ProductListRecord['variants'][number] {
  const [first, ...others] = product.variants;
  if (!first) {
    // The repository only returns products that have variants.
    throw new Error(`Product ${product.id} has no variants`);
  }
  return others.reduce((best, variant) => (variant.price < best.price ? variant : best), first);
}

export function toProductResponse(product: ProductListRecord): ProductResponse {
  const fromVariant = findLowestPriceVariant(product);
  const discountPercent = calculateDiscountPercent(fromVariant.price, fromVariant.originalPrice);

  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    price: fromVariant.price,
    originalPrice: discountPercent === null ? null : fromVariant.originalPrice,
    discountPercent,
    rating: tenthsToRating(product.ratingTenths),
    soldCount: product.soldCount,
    city: product.shop.city,
    imageUrl: toImageUrl(product.imageUrl),
    shopSlug: product.shop.slug,
    shopName: product.shop.name,
  };
}

export function toReviewResponse(review: ReviewRecord): ReviewResponse {
  return {
    id: String(review.id),
    authorName: review.authorName,
    authorAvatarUrl: review.authorAvatarUrl === null ? null : toImageUrl(review.authorAvatarUrl),
    rating: review.rating,
    text: review.text,
    createdAt: review.createdAt.toISOString(),
  };
}

// The one place a product record becomes the detail response.
// It sorts by position and date itself, so the result does not depend on query order.
export function toProductDetailResponse(
  product: ProductDetailRecord,
  reviews: ReviewRecord[],
): ProductDetailResponse {
  const variants = [...product.variants].sort((a, b) => a.position - b.position || a.id - b.id);
  const firstVariant = variants[0];
  if (!firstVariant) {
    // The repository only returns products that have variants.
    throw new Error(`Product ${product.id} has no variants`);
  }

  const images = [...product.images].sort((a, b) => a.position - b.position || a.id - b.id);
  const newestReviews = [...reviews]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
    .slice(0, REVIEW_PREVIEW_LIMIT);

  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    description: product.description,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    soldCount: product.soldCount,
    rating: {
      average: tenthsToRating(product.ratingTenths),
      ratingCount: product.ratingCount,
      reviewCount: product.reviewCount,
    },
    images: images.map((image) => ({ id: String(image.id), url: toImageUrl(image.url), alt: image.alt })),
    variants: variants.map((variant) => ({
      id: String(variant.id),
      label: variant.label,
      unit: variant.unit,
      price: variant.price,
      originalPrice: variant.originalPrice,
      stock: variant.stock,
    })),
    defaultVariantId: String(firstVariant.id),
    shop: {
      slug: product.shop.slug,
      name: product.shop.name,
      city: product.shop.city,
      logoUrl: product.shop.logoUrl === null ? null : toImageUrl(product.shop.logoUrl),
      rating: toShopRating(product.shop.ratingTenths, product.shop.ratingCount),
    },
    reviewPreview: newestReviews.map(toReviewResponse),
  };
}

async function listProducts(query: ProductListQuery): Promise<ProductListResponse> {
  if (query.category && !(await categoryRepository.findBySlug(query.category))) {
    throw new ValidationError('Please fix the highlighted fields.', {
      category: 'Unknown category.',
    });
  }
  if (query.shop && !(await shopRepository.findBySlug(query.shop))) {
    throw new ValidationError('Please fix the highlighted fields.', { shop: 'Shop not found.' });
  }

  const filter: ProductFilter = {
    categorySlug: query.category,
    shopSlug: query.shop,
    excludeId: query.exclude === undefined ? undefined : Number(query.exclude),
    discountOnly: query.discount,
  };
  const skip = (query.page - 1) * query.limit;

  if (query.sort === 'price_asc' || query.sort === 'price_desc') {
    // Price sorting happens here because it needs each product's lowest variant price.
    // Fine for a small catalog. Revisit if the catalog grows to many thousands of products.
    const all = (await productRepository.findAll(filter)).map(toProductResponse);
    const direction = query.sort === 'price_asc' ? 1 : -1;
    all.sort((a, b) => (a.price - b.price) * direction);
    return {
      products: all.slice(skip, skip + query.limit),
      pagination: buildPagination(query.page, query.limit, all.length),
    };
  }

  const [records, total] = await Promise.all([
    productRepository.findMany(filter, query.sort, skip, query.limit),
    productRepository.count(filter),
  ]);
  return {
    products: records.map(toProductResponse),
    pagination: buildPagination(query.page, query.limit, total),
  };
}

async function getProductDetail(slug: string): Promise<ProductDetailResponse> {
  const product = await productRepository.findActiveBySlug(slug);
  if (!product) {
    throw new NotFoundError('Product not found.');
  }
  const reviews = await reviewRepository.findVisibleByProduct(product.id, 0, REVIEW_PREVIEW_LIMIT);
  return toProductDetailResponse(product, reviews);
}

async function getProductReviews(slug: string, query: ReviewListQuery): Promise<ReviewListResponse> {
  const product = await productRepository.findActiveIdBySlug(slug);
  if (!product) {
    throw new NotFoundError('Product not found.');
  }

  const skip = (query.page - 1) * query.limit;
  const [reviews, total] = await Promise.all([
    reviewRepository.findVisibleByProduct(product.id, skip, query.limit),
    reviewRepository.countVisibleByProduct(product.id),
  ]);
  return {
    reviews: reviews.map(toReviewResponse),
    pagination: buildPagination(query.page, query.limit, total),
  };
}

// Best sellers, leaving out one product and/or every product of one shop.
async function getRecommended(query: RecommendedQuery): Promise<{ products: ProductResponse[] }> {
  const filter: ProductFilter = {
    discountOnly: false,
    excludeId: query.exclude === undefined ? undefined : Number(query.exclude),
    excludeShopSlug: query.excludeShop,
  };
  const records = await productRepository.findMany(filter, 'popular', 0, query.limit);
  return { products: records.map(toProductResponse) };
}

export const productService = { listProducts, getProductDetail, getProductReviews, getRecommended };
