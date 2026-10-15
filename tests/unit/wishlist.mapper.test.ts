import { describe, expect, it } from 'vitest';
import type { WishlistItemRecord } from '../../src/repositories/wishlist.repository.js';
import { toWishlistProduct, toWishlistResponse } from '../../src/services/wishlist.mapper.js';

interface VariantInput {
  price: number;
  originalPrice?: number | null;
  stock: number;
}

// Builds a record the way the repository returns it (variants cheapest first).
function record(id: number, addedAt: string, variants: VariantInput[], name = `P${id}`): WishlistItemRecord {
  const sorted = [...variants].sort((a, b) => a.price - b.price);
  return {
    id,
    addedAt: new Date(addedAt),
    product: {
      id: id * 100,
      slug: name.toLowerCase(),
      name,
      imageUrl: '/images/dummy/x.jpg',
      ratingTenths: 34,
      soldCount: 12,
      category: { slug: 'fruits', name: 'Fruits' },
      shop: { slug: 'shop', name: 'Shop', city: 'Jakarta' },
      variants: sorted.map((variant) => ({
        price: variant.price,
        originalPrice: variant.originalPrice ?? null,
        stock: variant.stock,
      })),
    },
  };
}

describe('toWishlistProduct', () => {
  it('has the product list shape with a shop object and isAvailable', () => {
    const product = toWishlistProduct(record(1, '2026-01-01', [{ price: 1000, stock: 5 }]).product);

    expect(product).toEqual({
      id: '100',
      slug: 'p1',
      name: 'P1',
      categorySlug: 'fruits',
      categoryName: 'Fruits',
      price: 1000,
      originalPrice: null,
      discountPercent: null,
      rating: 3.4,
      soldCount: 12,
      city: 'Jakarta',
      imageUrl: '/images/dummy/x.jpg',
      shop: { slug: 'shop', name: 'Shop' },
      isAvailable: true,
    });
  });

  it('takes price, originalPrice and discountPercent from the lowest variant', () => {
    const product = toWishlistProduct(
      record(1, '2026-01-01', [
        { price: 4000, originalPrice: 9000, stock: 1 },
        { price: 1000, originalPrice: 1250, stock: 1 },
      ]).product,
    );

    expect(product).toMatchObject({ price: 1000, originalPrice: 1250, discountPercent: 20 });
  });

  it('does not take the discount from a variant that is not the cheapest', () => {
    const product = toWishlistProduct(
      record(1, '2026-01-01', [
        { price: 1000, stock: 1 },
        { price: 3000, originalPrice: 4000, stock: 1 },
      ]).product,
    );

    expect(product).toMatchObject({ price: 1000, originalPrice: null, discountPercent: null });
  });

  it('is available when any variant has stock, even if the cheapest has none', () => {
    const product = toWishlistProduct(
      record(1, '2026-01-01', [
        { price: 1000, stock: 0 },
        { price: 2000, stock: 3 },
      ]).product,
    );

    expect(product.isAvailable).toBe(true);
  });

  it('is not available when every variant has 0 stock', () => {
    const product = toWishlistProduct(
      record(1, '2026-01-01', [
        { price: 1000, stock: 0 },
        { price: 2000, stock: 0 },
      ]).product,
    );

    expect(product.isAvailable).toBe(false);
  });

  it('does not expose internal fields', () => {
    const body = JSON.stringify(toWishlistProduct(record(1, '2026-01-01', [{ price: 1, stock: 1 }]).product));

    expect(body).not.toMatch(/userId|ownerId|isActive|shopSlug|shopName|stock/);
  });
});

describe('toWishlistResponse', () => {
  it('orders by addedAt descending, then id descending', () => {
    const variants = [{ price: 1000, stock: 1 }];
    const response = toWishlistResponse([
      record(1, '2026-01-01T00:00:00Z', variants),
      record(2, '2026-01-03T00:00:00Z', variants),
      record(3, '2026-01-02T00:00:00Z', variants),
      record(4, '2026-01-02T00:00:00Z', variants),
    ]);

    expect(response.items.map((item) => item.id)).toEqual(['2', '4', '3', '1']);
  });

  it('returns addedAt as ISO 8601 and counts the items', () => {
    const response = toWishlistResponse([record(1, '2026-01-01T00:00:00Z', [{ price: 1, stock: 1 }])]);

    expect(response.items[0]?.addedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(response.itemCount).toBe(1);
  });

  it('returns an empty wishlist', () => {
    expect(toWishlistResponse([])).toEqual({ items: [], itemCount: 0 });
  });
});
