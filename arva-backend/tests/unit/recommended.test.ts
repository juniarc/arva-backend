import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fakeProducts } = vi.hoisted(() => ({
  fakeProducts: {
    findMany: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    findActiveBySlug: vi.fn(),
    findActiveIdBySlug: vi.fn(),
  },
}));

vi.mock('../../src/repositories/product.repository.js', () => ({ productRepository: fakeProducts }));
vi.mock('../../src/repositories/category.repository.js', () => ({
  categoryRepository: { findBySlug: vi.fn(), findAll: vi.fn() },
}));
vi.mock('../../src/repositories/review.repository.js', () => ({ reviewRepository: {} }));
vi.mock('../../src/repositories/shop.repository.js', () => ({ shopRepository: { findBySlug: vi.fn() } }));

const { productService } = await import('../../src/services/product.service.js');

beforeEach(() => {
  vi.resetAllMocks();
  fakeProducts.findMany.mockResolvedValue([]);
});

describe('productService.getRecommended', () => {
  it('excludes the given product and every product of the given shop', async () => {
    await productService.getRecommended({ exclude: '7', excludeShop: 'shops-name', limit: 6 });

    expect(fakeProducts.findMany).toHaveBeenCalledWith(
      { discountOnly: false, excludeId: 7, excludeShopSlug: 'shops-name' },
      'popular',
      0,
      6,
    );
  });

  it('works without any exclusion and passes the limit through', async () => {
    await productService.getRecommended({ limit: 24 });

    expect(fakeProducts.findMany).toHaveBeenCalledWith(
      { discountOnly: false, excludeId: undefined, excludeShopSlug: undefined },
      'popular',
      0,
      24,
    );
  });
});
