import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

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
}

export type DatabaseSort = 'popular' | 'newest';

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
  return { AND: conditions };
}

const orderBySort: Record<DatabaseSort, Prisma.ProductOrderByWithRelationInput[]> = {
  popular: [{ soldCount: 'desc' }, { id: 'asc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
};

function findMany(
  filter: ProductFilter,
  sort: DatabaseSort,
  skip: number,
  take: number,
): Promise<ProductListRecord[]> {
  return prisma.product.findMany({
    where: buildWhere(filter),
    orderBy: orderBySort[sort],
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
    orderBy: orderBySort.popular,
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
