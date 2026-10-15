import { describe, expect, it } from 'vitest';
import {
  comparePrice,
  isPriceSort,
  PRODUCT_SORTS,
  toDatabaseOrder,
  type DatabaseSort,
} from '../../src/lib/product-sort.js';

const databaseSorts: DatabaseSort[] = ['popular', 'newest', 'relevance'];

describe('toDatabaseOrder', () => {
  it('orders popular by soldCount, then rating, then id ascending', () => {
    expect(toDatabaseOrder('popular')).toEqual([{ soldCount: 'desc' }, { ratingTenths: 'desc' }, { id: 'asc' }]);
  });

  it('orders newest by createdAt, then id descending', () => {
    expect(toDatabaseOrder('newest')).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('orders relevance by soldCount, then ratingCount, then id ascending', () => {
    expect(toDatabaseOrder('relevance')).toEqual([{ soldCount: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }]);
  });

  it.each(databaseSorts)('ends %s with id as the tie-breaker', (sort) => {
    const order = toDatabaseOrder(sort);

    expect(Object.keys(order[order.length - 1] ?? {})).toEqual(['id']);
  });
});

describe('comparePrice', () => {
  const items = [
    { id: 3, price: 1000 },
    { id: 1, price: 1000 },
    { id: 2, price: 500 },
  ];

  it('sorts price_asc by price, then id ascending', () => {
    expect([...items].sort(comparePrice('price_asc')).map((i) => i.id)).toEqual([2, 1, 3]);
  });

  it('sorts price_desc by price, then id ascending', () => {
    expect([...items].sort(comparePrice('price_desc')).map((i) => i.id)).toEqual([1, 3, 2]);
  });
});

describe('isPriceSort', () => {
  it('is true only for the price sorts', () => {
    expect(PRODUCT_SORTS.filter(isPriceSort)).toEqual(['price_asc', 'price_desc']);
  });
});
