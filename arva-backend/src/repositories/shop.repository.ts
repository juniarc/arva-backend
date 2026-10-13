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

// Cities of shops that have at least one product the public list can show
// (active, with a variant). Only the city column is read.
async function findCitiesWithActiveProducts(): Promise<string[]> {
  const shops = await prisma.shop.findMany({
    where: { products: { some: { isActive: true, variants: { some: {} } } } },
    select: { city: true },
    distinct: ['city'],
  });
  return shops.map((shop) => shop.city);
}

export const shopRepository = { findBySlug, findCitiesWithActiveProducts };
