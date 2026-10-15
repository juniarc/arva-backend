// Ratings are stored as integer tenths (34 = 3.4) and returned as numbers with one decimal.

export function roundToOneDecimal(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}

export function tenthsToRating(tenths: number | null | undefined): number {
  return roundToOneDecimal((tenths ?? 0) / 10);
}

export interface ShopRatingResponse {
  average: number;
  ratingCount: number;
}

export function toShopRating(ratingTenths: number, ratingCount: number): ShopRatingResponse {
  return { average: tenthsToRating(ratingTenths), ratingCount };
}
