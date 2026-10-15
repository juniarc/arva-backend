import { describe, expect, it } from 'vitest';
import { calculateDiscountPercent, calculateLineTotal } from '../../src/lib/money.js';
import { toImageUrl } from '../../src/lib/imageUrl.js';
import { buildPagination } from '../../src/lib/pagination.js';

describe('calculateDiscountPercent', () => {
  it('returns 20 for 1000 against an original price of 1250', () => {
    expect(calculateDiscountPercent(1000, 1250)).toBe(20);
  });

  it('returns null when there is no original price', () => {
    expect(calculateDiscountPercent(1000, null)).toBeNull();
  });

  it('returns null when the original price is not higher than the price', () => {
    expect(calculateDiscountPercent(2000, 2000)).toBeNull();
    expect(calculateDiscountPercent(2000, 1500)).toBeNull();
  });

  it('rounds to a whole number', () => {
    // (1250 - 1000) / 1250 = 20% exactly, but 9000 vs 10000 is 10%, and 8500 vs 9000 is 5.55...%
    expect(calculateDiscountPercent(8500, 9000)).toBe(6);
    // 1900 vs 2500 is 24%
    expect(calculateDiscountPercent(1900, 2500)).toBe(24);
    // 1 vs 3 is 66.66...%
    expect(calculateDiscountPercent(1, 3)).toBe(67);
  });
});

describe('calculateLineTotal', () => {
  it('multiplies price by quantity', () => {
    expect(calculateLineTotal(15000, 3)).toBe(45000);
  });
});

describe('buildPagination', () => {
  it('computes totalPages and handles an empty result', () => {
    expect(buildPagination(1, 12, 25)).toEqual({ page: 1, limit: 12, total: 25, totalPages: 3 });
    expect(buildPagination(1, 12, 0)).toEqual({ page: 1, limit: 12, total: 0, totalPages: 0 });
  });
});

describe('toImageUrl', () => {
  it('adds the base URL to a stored path', () => {
    expect(toImageUrl('/images/dummy/a.jpg', 'http://localhost:3000')).toBe(
      'http://localhost:3000/images/dummy/a.jpg',
    );
    expect(toImageUrl('images/a.jpg', 'http://localhost:3000/')).toBe('http://localhost:3000/images/a.jpg');
  });

  it('returns full URLs and paths without a base URL unchanged', () => {
    expect(toImageUrl('https://cdn.example.com/a.jpg', 'http://localhost:3000')).toBe(
      'https://cdn.example.com/a.jpg',
    );
    expect(toImageUrl('/images/a.jpg', undefined)).toBe('/images/a.jpg');
  });
});
