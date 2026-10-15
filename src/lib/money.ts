// Money is always an integer number of IDR. Never use floats for amounts.

// Percent off, rounded to a whole number. Returns null when the item is not discounted.
export function calculateDiscountPercent(price: number, originalPrice: number | null): number | null {
  if (originalPrice === null || originalPrice <= price) {
    return null;
  }
  return Math.round(((originalPrice - price) * 100) / originalPrice);
}

export function calculateLineTotal(price: number, quantity: number): number {
  return price * quantity;
}
