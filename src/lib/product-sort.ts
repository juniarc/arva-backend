import type { Prisma } from '@prisma/client';

export const PRODUCT_SORTS = ['popular', 'newest', 'price_asc', 'price_desc', 'relevance'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

// Sorts the database can do. The price sorts cannot, because Prisma cannot order by the
// lowest price of a related list. The service sorts those itself (see comparePrice).
export type DatabaseSort = Exclude<ProductSort, 'price_asc' | 'price_desc'>;
export type PriceSort = Exclude<ProductSort, DatabaseSort>;

type ProductOrder = Prisma.ProductOrderByWithRelationInput[];

// PLACEHOLDER ranking until a real relevance model exists (there is no text search yet).
// The formula lives only here, so it can change without touching callers.
function relevanceOrder(): ProductOrder {
  return [{ soldCount: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }];
}

// Every order ends with id, so no two products tie and pages never repeat or skip a product.
export function toDatabaseOrder(sort: DatabaseSort): ProductOrder {
  switch (sort) {
    case 'popular':
      return [{ soldCount: 'desc' }, { ratingTenths: 'desc' }, { id: 'asc' }];
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    case 'relevance':
      return relevanceOrder();
  }
}

export function isPriceSort(sort: ProductSort): sort is PriceSort {
  return sort === 'price_asc' || sort === 'price_desc';
}

interface PricedProduct {
  id: number;
  price: number;
}

// Lowest variant price, then id ascending as the tie-breaker (for both directions).
export function comparePrice(sort: PriceSort): (a: PricedProduct, b: PricedProduct) => number {
  const direction = sort === 'price_asc' ? 1 : -1;
  return (a, b) => (a.price - b.price) * direction || a.id - b.id;
}
