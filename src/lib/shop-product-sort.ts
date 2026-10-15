import type { Prisma } from '@prisma/client';

export type ShopProductSort = 'newest' | 'popular';

// Every order ends with id, so pages never repeat or skip a product.
export function toShopProductOrder(sort: ShopProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    case 'popular':
      return [{ soldCount: 'desc' }, { ratingCount: 'desc' }, { id: 'desc' }];
  }
}
