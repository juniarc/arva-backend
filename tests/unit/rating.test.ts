import { describe, expect, it } from 'vitest';
import { roundToOneDecimal, tenthsToRating, toShopRating } from '../../src/lib/rating.js';

describe('roundToOneDecimal', () => {
  it('rounds 3.36 to 3.4', () => {
    expect(roundToOneDecimal(3.36)).toBe(3.4);
  });

  it('keeps 4 as 4 (JSON shows it as 4, the number is 4.0)', () => {
    expect(roundToOneDecimal(4)).toBe(4);
    expect(roundToOneDecimal(4).toFixed(1)).toBe('4.0');
  });

  it('handles null, undefined and NaN as 0', () => {
    expect(roundToOneDecimal(null)).toBe(0);
    expect(roundToOneDecimal(undefined)).toBe(0);
    expect(roundToOneDecimal(Number.NaN)).toBe(0);
  });
});

describe('tenthsToRating', () => {
  it('turns stored tenths into a rating with one decimal', () => {
    expect(tenthsToRating(34)).toBe(3.4);
    expect(tenthsToRating(40)).toBe(4);
    expect(tenthsToRating(0)).toBe(0);
    expect(tenthsToRating(null)).toBe(0);
  });
});

describe('toShopRating', () => {
  it('maps tenths and count to the API shape', () => {
    expect(toShopRating(34, 212)).toEqual({ average: 3.4, ratingCount: 212 });
  });
});
