import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { toShopProductOrder, type ShopProductSort } from '../lib/shop-product-sort.js';

// The product list's fields, plus what the owner's manage block needs (stock, labels, ratingCount,
// isActive). Variants come back cheapest first, like the product list. No user field is selected.
const shopProductSelect = {
  id: true,
  slug: true,
  name: true,
  imageUrl: true,
  ratingTenths: true,
  ratingCount: true,
  soldCount: true,
  isActive: true,
  category: { select: { slug: true, name: true } },
  shop: { select: { slug: true, name: true, city: true } },
  variants: {
    select: { label: true, price: true, originalPrice: true, stock: true, position: true },
    orderBy: [{ price: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.ProductSelect;

export type ShopProductRecord = Prisma.ProductGetPayload<{ select: typeof shopProductSelect }>;

// The public sees active products only. The owner also sees inactive ones.
// Products without a variant are never listed, because they have no price.
function buildWhere(shopId: number, includeInactive: boolean): Prisma.ProductWhereInput {
  return {
    shopId,
    variants: { some: {} },
    ...(includeInactive ? {} : { isActive: true }),
  };
}

function findPage(
  shopId: number,
  includeInactive: boolean,
  sort: ShopProductSort,
  skip: number,
  take: number,
): Promise<ShopProductRecord[]> {
  return prisma.product.findMany({
    where: buildWhere(shopId, includeInactive),
    orderBy: toShopProductOrder(sort),
    skip,
    take,
    select: shopProductSelect,
  });
}

// Counts the same filtered set as findPage.
function count(shopId: number, includeInactive: boolean): Promise<number> {
  return prisma.product.count({ where: buildWhere(shopId, includeInactive) });
}

export const shopProductRepository = { findPage, count };
