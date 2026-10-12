import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// ownerId is deliberately not selected: it must never reach the API.
const shopSelect = {
  slug: true,
  name: true,
  city: true,
  logoUrl: true,
  ratingTenths: true,
  ratingCount: true,
  _count: { select: { products: { where: { isActive: true } } } },
} satisfies Prisma.ShopSelect;

export type ShopRecord = Prisma.ShopGetPayload<{ select: typeof shopSelect }>;

function findBySlug(slug: string): Promise<ShopRecord | null> {
  return prisma.shop.findUnique({ where: { slug }, select: shopSelect });
}

export const shopRepository = { findBySlug };
