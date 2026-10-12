import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/lib/errors.js';
import type { ProductListRecord } from '../../src/repositories/product.repository.js';

const { fakeProducts, fakeCategories, fakeShops, fakeReviews } = vi.hoisted(() => ({
  fakeProducts: {
    findMany: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    findActiveBySlug: vi.fn(),
    findActiveIdBySlug: vi.fn(),
  },
  fakeCategories: { findBySlug: vi.fn(), findAll: vi.fn() },
  fakeShops: { findBySlug: vi.fn() },
  fakeReviews: { findVisibleByProduct: vi.fn(), countVisibleByProduct: vi.fn() },
}));

vi.mock('../../src/repositories/product.repository.js', () => ({ productRepository: fakeProducts }));
vi.mock('../../src/repositories/category.repository.js', () => ({
  categoryRepository: fakeCategories,
}));
vi.mock('../../src/repositories/shop.repository.js', () => ({ shopRepository: fakeShops }));
vi.mock('../../src/repositories/review.repository.js', () => ({ reviewRepository: fakeReviews }));

const { productService, toProductResponse } = await import('../../src/services/product.service.js');

interface VariantInput {
  price: number;
  originalPrice?: number | null;
}

// Builds a product record the way the repository returns it (variants cheapest first).
function buildProduct(id: number, name: string, variants: VariantInput[]): ProductListRecord {
  const sorted = [...variants].sort((a, b) => a.price - b.price);
  return {
    id,
    slug: name.toLowerCase(),
    name,
    imageUrl: `/images/dummy/${name.toLowerCase()}.jpg`,
    ratingTenths: 34,
    soldCount: 10,
    category: { slug: 'fruits', name: 'Fruits' },
    shop: { slug: 'shop', name: 'Shop', city: 'Jakarta' },
    variants: sorted.map((variant) => ({
      price: variant.price,
      originalPrice: variant.originalPrice ?? null,
    })),
  };
}

const defaultQuery = { sort: 'popular', discount: false, page: 1, limit: 12 } as const;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('toProductResponse', () => {
  it('uses the lowest variant price as the "from" price', () => {
    const product = buildProduct(1, 'Banana', [{ price: 4500 }, { price: 1000, originalPrice: 1250 }]);

    expect(toProductResponse(product)).toMatchObject({
      id: '1',
      price: 1000,
      originalPrice: 1250,
      discountPercent: 20,
      rating: 3.4,
      city: 'Jakarta',
      shopSlug: 'shop',
      shopName: 'Shop',
      categorySlug: 'fruits',
    });
  });

  it('takes the discount from the lowest variant only', () => {
    const product = buildProduct(1, 'Banana', [{ price: 1000 }, { price: 3000, originalPrice: 4000 }]);

    expect(toProductResponse(product)).toMatchObject({
      price: 1000,
      originalPrice: null,
      discountPercent: null,
    });
  });

  it('does not expose internal fields', () => {
    const body = JSON.stringify(toProductResponse(buildProduct(1, 'Banana', [{ price: 1000 }])));

    expect(body).not.toMatch(/ownerId|isActive|createdAt|updatedAt/);
  });
});

describe('productService.listProducts', () => {
  it('sorts by the lowest variant price for price_asc', async () => {
    fakeProducts.findAll.mockResolvedValue([
      buildProduct(1, 'A', [{ price: 5000 }, { price: 900 }]),
      buildProduct(2, 'B', [{ price: 700 }]),
      buildProduct(3, 'C', [{ price: 1500 }]),
    ]);

    const result = await productService.listProducts({ ...defaultQuery, sort: 'price_asc' });

    expect(result.products.map((p) => p.slug)).toEqual(['b', 'a', 'c']);
    expect(result.pagination).toEqual({ page: 1, limit: 12, total: 3, totalPages: 1 });
  });

  it('sorts by the lowest variant price for price_desc and paginates', async () => {
    fakeProducts.findAll.mockResolvedValue([
      buildProduct(1, 'A', [{ price: 900 }]),
      buildProduct(2, 'B', [{ price: 700 }]),
      buildProduct(3, 'C', [{ price: 1500 }]),
    ]);

    const result = await productService.listProducts({
      ...defaultQuery,
      sort: 'price_desc',
      page: 2,
      limit: 2,
    });

    expect(result.products.map((p) => p.slug)).toEqual(['b']);
    expect(result.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('lets the database sort and paginate for popular', async () => {
    fakeProducts.findMany.mockResolvedValue([buildProduct(1, 'A', [{ price: 900 }])]);
    fakeProducts.count.mockResolvedValue(30);

    const result = await productService.listProducts({ ...defaultQuery, page: 3, limit: 12 });

    expect(fakeProducts.findMany).toHaveBeenCalledWith(
      { categorySlug: undefined, shopSlug: undefined, excludeId: undefined, discountOnly: false },
      'popular',
      24,
      12,
    );
    expect(result.pagination).toEqual({ page: 3, limit: 12, total: 30, totalPages: 3 });
  });

  it('passes the shop and exclude filters to the repository', async () => {
    fakeShops.findBySlug.mockResolvedValue({ slug: 'shops-name' });
    fakeProducts.findMany.mockResolvedValue([]);
    fakeProducts.count.mockResolvedValue(0);

    await productService.listProducts({ ...defaultQuery, shop: 'shops-name', exclude: '5' });

    expect(fakeProducts.findMany).toHaveBeenCalledWith(
      { categorySlug: undefined, shopSlug: 'shops-name', excludeId: 5, discountOnly: false },
      'popular',
      0,
      12,
    );
  });

  it('rejects an unknown category with a field error', async () => {
    fakeCategories.findBySlug.mockResolvedValue(null);

    const error = await productService
      .listProducts({ ...defaultQuery, category: 'nope' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual({ category: 'Unknown category.' });
  });

  it('rejects an unknown shop with a field error', async () => {
    fakeShops.findBySlug.mockResolvedValue(null);

    const error = await productService
      .listProducts({ ...defaultQuery, shop: 'nope' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual({ shop: 'Shop not found.' });
  });
});

describe('productService.getProductDetail and getProductReviews', () => {
  it('throws NotFoundError for an unknown product', async () => {
    fakeProducts.findActiveBySlug.mockResolvedValue(null);
    fakeProducts.findActiveIdBySlug.mockResolvedValue(null);

    await expect(productService.getProductDetail('nope')).rejects.toBeInstanceOf(NotFoundError);
    await expect(productService.getProductReviews('nope', { page: 1, limit: 10 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
