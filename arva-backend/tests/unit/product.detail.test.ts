import { describe, expect, it } from 'vitest';
import type { ProductDetailRecord } from '../../src/repositories/product.repository.js';
import type { ReviewRecord } from '../../src/repositories/review.repository.js';
import { toProductDetailResponse } from '../../src/services/product.service.js';

const DAY = 24 * 60 * 60 * 1000;

// Deliberately out of order, to prove the mapper sorts by position.
function buildProduct(): ProductDetailRecord {
  return {
    id: 1,
    slug: 'bali-banana-fruit',
    name: "Bali's Banana Fruit",
    description: 'Banana Fruit from Bali, Indonesia.',
    soldCount: 501,
    ratingTenths: 34,
    ratingCount: 212,
    reviewCount: 104,
    category: { slug: 'fruits', name: 'Fruits' },
    shop: {
      slug: 'shops-name',
      name: "Shop's Name",
      city: 'Jakarta',
      logoUrl: '/images/dummy/shop-logo-placeholder.jpg',
      ratingTenths: 34,
      ratingCount: 212,
    },
    images: [
      { id: 12, url: '/b.jpg', alt: 'second', position: 2 },
      { id: 11, url: '/a.jpg', alt: 'first', position: 1 },
      { id: 13, url: '/c.jpg', alt: 'third', position: 3 },
    ],
    variants: [
      { id: 22, label: '2 kg', unit: 'kg', price: 2000, originalPrice: null, stock: 3, position: 1 },
      { id: 23, label: '5 kg', unit: 'kg', price: 4500, originalPrice: null, stock: 0, position: 2 },
      { id: 21, label: '1 kg', unit: 'kg', price: 1000, originalPrice: 1250, stock: 250, position: 0 },
    ],
  };
}

function buildReview(id: number, daysAgo: number): ReviewRecord {
  return {
    id,
    authorName: 'username',
    authorAvatarUrl: null,
    rating: 4,
    text: `review ${id}`,
    createdAt: new Date(Date.UTC(2026, 9, 1) - daysAgo * DAY),
  };
}

describe('toProductDetailResponse', () => {
  it('orders variants by position and uses the first one as the default', () => {
    const result = toProductDetailResponse(buildProduct(), []);

    expect(result.variants.map((v) => v.label)).toEqual(['1 kg', '2 kg', '5 kg']);
    expect(result.defaultVariantId).toBe('21');
    expect(result.variants[0]).toEqual({
      id: '21',
      label: '1 kg',
      unit: 'kg',
      price: 1000,
      originalPrice: 1250,
      stock: 250,
    });
  });

  it('orders images by position', () => {
    const result = toProductDetailResponse(buildProduct(), []);

    expect(result.images.map((i) => i.alt)).toEqual(['first', 'second', 'third']);
    expect(result.images[0]).toEqual({ id: '11', url: '/a.jpg', alt: 'first' });
  });

  it('keeps the newest 10 reviews, newest first', () => {
    // 12 reviews, review n is n days old, supplied in scrambled order.
    const reviews = [5, 12, 1, 9, 3, 11, 2, 8, 4, 10, 7, 6].map((n) => buildReview(n, n));

    const result = toProductDetailResponse(buildProduct(), reviews);

    expect(result.reviewPreview).toHaveLength(10);
    expect(result.reviewPreview.map((r) => r.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('formats review dates as ISO 8601 strings', () => {
    const result = toProductDetailResponse(buildProduct(), [buildReview(1, 0)]);

    expect(result.reviewPreview[0]?.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('maps rating, shop and category', () => {
    const result = toProductDetailResponse(buildProduct(), []);

    expect(result.rating).toEqual({ average: 3.4, ratingCount: 212, reviewCount: 104 });
    expect(result.shop).toEqual({
      slug: 'shops-name',
      name: "Shop's Name",
      city: 'Jakarta',
      logoUrl: '/images/dummy/shop-logo-placeholder.jpg',
      rating: { average: 3.4, ratingCount: 212 },
    });
    expect(result.categorySlug).toBe('fruits');
    expect(result.categoryName).toBe('Fruits');
  });

  it('returns no internal fields', () => {
    const body = JSON.stringify(toProductDetailResponse(buildProduct(), [buildReview(1, 1)]));

    expect(body).not.toMatch(/ownerId|isActive|userId|isVisible|updatedAt/);
  });
});
