import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toShopProductOrder } from '../../src/lib/shop-product-sort.js';
import type { ShopProductRecord } from '../../src/repositories/shop-product.repository.js';

const { fakeShops, fakeProducts } = vi.hoisted(() => ({
  fakeShops: { findIdentityBySlug: vi.fn() },
  fakeProducts: { findPage: vi.fn(), count: vi.fn() },
}));

vi.mock('../../src/repositories/shop.repository.js', () => ({ shopRepository: fakeShops }));
vi.mock('../../src/repositories/shop-product.repository.js', () => ({ shopProductRepository: fakeProducts }));

const { shopService, toShopProductResponse } = await import('../../src/services/shop.service.js');

function product(overrides: Partial<ShopProductRecord> = {}): ShopProductRecord {
  return {
    id: 7,
    slug: 'banana',
    name: 'Banana',
    imageUrl: '/images/dummy/banana.jpg',
    ratingTenths: 34,
    ratingCount: 12,
    soldCount: 50,
    isActive: true,
    category: { slug: 'fruits', name: 'Fruits' },
    shop: { slug: 'my-shop', name: 'My Shop', city: 'Jakarta' },
    // Cheapest first, as the repository returns them.
    variants: [
      { label: '1 kg', price: 1000, originalPrice: 1250, stock: 10, position: 1 },
      { label: '5 kg', price: 4500, originalPrice: null, stock: 4, position: 2 },
      { label: '500 g', price: 1200, originalPrice: null, stock: 0, position: 0 },
    ].sort((a, b) => a.price - b.price),
    ...overrides,
  };
}

const query = { page: 2, limit: 5, sort: 'popular' } as const;

beforeEach(() => {
  vi.clearAllMocks();
  fakeProducts.findPage.mockResolvedValue([]);
  fakeProducts.count.mockResolvedValue(0);
});

describe('toShopProductResponse', () => {
  it('takes price, original price and discount from the lowest priced variant', () => {
    const response = toShopProductResponse(product(), false);

    expect(response).toMatchObject({
      id: '7',
      slug: 'banana',
      categoryName: 'Fruits',
      price: 1000,
      originalPrice: 1250,
      discountPercent: 20,
      rating: 3.4,
      soldCount: 50,
      city: 'Jakarta',
      shop: { slug: 'my-shop', name: 'My Shop' },
    });
  });

  it('has manage null for a public viewer', () => {
    expect(toShopProductResponse(product(), false).manage).toBeNull();
  });

  it('fills manage for the owner: stock summed and labels in position order', () => {
    const response = toShopProductResponse(product({ isActive: false }), true);

    expect(response.manage).toEqual({
      isActive: false,
      totalStock: 14,
      variantLabels: ['500 g', '1 kg', '5 kg'],
      ratingCount: 12,
    });
  });

  it('does not expose internal or user fields', () => {
    const text = JSON.stringify(toShopProductResponse(product(), true));

    expect(text).not.toMatch(/ownerId|email|phone|userId|categorySlug|shopSlug/);
  });
});

describe('shopService.getShopProducts: public and owner filter', () => {
  it('asks for active products only when the viewer is a guest', async () => {
    fakeShops.findIdentityBySlug.mockResolvedValue({ id: 3, ownerId: 9 });

    await shopService.getShopProducts('my-shop', undefined, query);

    expect(fakeProducts.findPage).toHaveBeenCalledWith(3, false, 'popular', 5, 5);
    expect(fakeProducts.count).toHaveBeenCalledWith(3, false);
  });

  it('asks for active products only when the viewer owns another shop', async () => {
    fakeShops.findIdentityBySlug.mockResolvedValue({ id: 3, ownerId: 9 });

    await shopService.getShopProducts('my-shop', 5, query);

    expect(fakeProducts.findPage).toHaveBeenCalledWith(3, false, 'popular', 5, 5);
  });

  it('includes inactive products for the owner, and counts the same set', async () => {
    fakeShops.findIdentityBySlug.mockResolvedValue({ id: 3, ownerId: 9 });
    fakeProducts.findPage.mockResolvedValue([product()]);
    fakeProducts.count.mockResolvedValue(11);

    const result = await shopService.getShopProducts('my-shop', 9, query);

    expect(fakeProducts.findPage).toHaveBeenCalledWith(3, true, 'popular', 5, 5);
    expect(fakeProducts.count).toHaveBeenCalledWith(3, true);
    expect(result.products[0]?.manage).not.toBeNull();
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 11, totalPages: 3 });
  });

  it('never treats a shop without an owner as owned by a guest', async () => {
    fakeShops.findIdentityBySlug.mockResolvedValue({ id: 3, ownerId: null });

    await shopService.getShopProducts('my-shop', undefined, query);

    expect(fakeProducts.findPage).toHaveBeenCalledWith(3, false, 'popular', 5, 5);
  });
});

describe('toShopProductOrder', () => {
  it('orders newest by createdAt, then id descending', () => {
    expect(toShopProductOrder('newest')).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('orders popular by soldCount, then ratingCount, then id descending', () => {
    expect(toShopProductOrder('popular')).toEqual([{ soldCount: 'desc' }, { ratingCount: 'desc' }, { id: 'desc' }]);
  });

  it.each(['newest', 'popular'] as const)('ends %s with id as the tie-breaker', (sort) => {
    const order = toShopProductOrder(sort);

    expect(Object.keys(order[order.length - 1] ?? {})).toEqual(['id']);
  });
});
