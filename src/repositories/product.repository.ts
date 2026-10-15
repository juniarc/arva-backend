import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { toDatabaseOrder, type DatabaseSort } from '../lib/product-sort.js';

// Every query uses `select`, so only the listed columns ever leave the repository.
// isActive, createdAt and the shop's ownerId are never selected.

// Variants come back cheapest first, so variants[0] is the "from" variant.
const listSelect = {
  id: true,
  slug: true,
  name: true,
  imageUrl: true,
  ratingTenths: true,
  soldCount: true,
  category: { select: { slug: true, name: true } },
  shop: { select: { slug: true, name: true, city: true } },
  variants: {
    select: { price: true, originalPrice: true },
    orderBy: [{ price: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.ProductSelect;

const detailSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  soldCount: true,
  ratingTenths: true,
  ratingCount: true,
  reviewCount: true,
  category: { select: { slug: true, name: true } },
  shop: {
    select: { slug: true, name: true, city: true, logoUrl: true, ratingTenths: true, ratingCount: true },
  },
  images: {
    select: { id: true, url: true, alt: true, position: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  },
  variants: {
    select: { id: true, label: true, unit: true, price: true, originalPrice: true, stock: true, position: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.ProductSelect;

export type ProductListRecord = Prisma.ProductGetPayload<{ select: typeof listSelect }>;
export type ProductDetailRecord = Prisma.ProductGetPayload<{ select: typeof detailSelect }>;

export interface ProductFilter {
  categorySlug?: string;
  shopSlug?: string;
  excludeShopSlug?: string;
  excludeId?: number;
  discountOnly: boolean;
  // Compared with the LOWEST variant price of the product.
  minPrice?: number;
  maxPrice?: number;
  // Rating in tenths (40 = 4.0 stars).
  minRatingTenths?: number;
  // Exact, case-sensitive match against the shop city.
  city?: string;
  // Search words: every word must be in the name, description, tags, category or shop name.
  searchWords?: string[];
}

// Only active products that have at least one variant are ever returned.
function buildWhere(filter: ProductFilter): Prisma.ProductWhereInput {
  const conditions: Prisma.ProductWhereInput[] = [
    { isActive: true },
    { variants: { some: filter.discountOnly ? { originalPrice: { not: null } } : {} } },
  ];
  if (filter.categorySlug) {
    conditions.push({ category: { slug: filter.categorySlug } });
  }
  if (filter.shopSlug) {
    conditions.push({ shop: { slug: filter.shopSlug } });
  }
  if (filter.excludeShopSlug) {
    conditions.push({ shop: { slug: { not: filter.excludeShopSlug } } });
  }
  if (filter.excludeId !== undefined) {
    conditions.push({ id: { not: filter.excludeId } });
  }
  // The lowest price is >= minPrice exactly when EVERY variant is >= minPrice,
  // and <= maxPrice exactly when SOME variant is <= maxPrice. No raw SQL needed.
  if (filter.minPrice !== undefined) {
    conditions.push({ variants: { every: { price: { gte: filter.minPrice } } } });
  }
  if (filter.maxPrice !== undefined) {
    conditions.push({ variants: { some: { price: { lte: filter.maxPrice } } } });
  }
  // Products without ratings have 0 tenths, so any minimum of 1 star or more excludes them.
  if (filter.minRatingTenths !== undefined) {
    conditions.push({ ratingTenths: { gte: filter.minRatingTenths } });
  }
  if (filter.city !== undefined) {
    conditions.push({ shop: { city: filter.city } });
  }
  for (const word of filter.searchWords ?? []) {
    const contains = { contains: word, mode: 'insensitive' as const };
    conditions.push({
      OR: [
        { name: contains },
        { description: contains },
        // Tags are stored in lower case, so a whole-word tag match is exact.
        { tags: { has: word } },
        { category: { name: contains } },
        { shop: { name: contains } },
      ],
    });
  }
  return { AND: conditions };
}

function findMany(
  filter: ProductFilter,
  sort: DatabaseSort,
  skip: number,
  take: number,
): Promise<ProductListRecord[]> {
  return prisma.product.findMany({
    where: buildWhere(filter),
    orderBy: toDatabaseOrder(sort),
    skip,
    take,
    select: listSelect,
  });
}

// Used for price sorting, which Prisma cannot do in the database
// because it cannot order by the minimum of a related list.
function findAll(filter: ProductFilter): Promise<ProductListRecord[]> {
  return prisma.product.findMany({
    where: buildWhere(filter),
    orderBy: toDatabaseOrder('popular'),
    select: listSelect,
  });
}

function count(filter: ProductFilter): Promise<number> {
  return prisma.product.count({ where: buildWhere(filter) });
}

function findActiveBySlug(slug: string): Promise<ProductDetailRecord | null> {
  return prisma.product.findFirst({
    where: { slug, isActive: true, variants: { some: {} } },
    select: detailSelect,
  });
}

function findActiveIdBySlug(slug: string): Promise<{ id: number } | null> {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  });
}

export const productRepository = { findMany, findAll, count, findActiveBySlug, findActiveIdBySlug };
