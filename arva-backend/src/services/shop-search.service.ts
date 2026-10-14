import { toImageUrl } from '../lib/imageUrl.js';
import { prisma } from '../lib/prisma.js';
import { searchWords } from '../lib/search-words.js';
import type { ShopSearchQuery } from '../schemas/shop.schema.js';

export interface ShopSearchItem {
  slug: string;
  name: string;
  city: string;
  logoUrl: string | null;
  rating: { average: number; ratingCount: number };
  productCount: number;
}

// Shops whose name or city contains every word of the search (any letter case). Best rated first.
async function searchShops(query: ShopSearchQuery): Promise<{ shops: ShopSearchItem[] }> {
  const words = searchWords(query.q);
  const shops = await prisma.shop.findMany({
    where: {
      AND: words.map((word) => ({
        OR: [{ name: { contains: word, mode: 'insensitive' as const } }, { city: { contains: word, mode: 'insensitive' as const } }],
      })),
    },
    orderBy: [{ ratingTenths: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }],
    take: query.limit,
    select: {
      slug: true,
      name: true,
      city: true,
      logoUrl: true,
      ratingTenths: true,
      ratingCount: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });

  return {
    shops: shops.map((shop) => ({
      slug: shop.slug,
      name: shop.name,
      city: shop.city,
      logoUrl: shop.logoUrl === null ? null : toImageUrl(shop.logoUrl),
      rating: { average: shop.ratingTenths / 10, ratingCount: shop.ratingCount },
      productCount: shop._count.products,
    })),
  };
}

export const shopSearchService = { searchShops };
