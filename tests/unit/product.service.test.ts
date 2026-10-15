import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { productListQuerySchema } from '../../src/schemas/product.schema.js';
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

describe('productService.listProducts filters', () => {
  it('passes the price, rating and city filters to the repository (rating as tenths)', async () => {
    fakeProducts.findMany.mockResolvedValue([]);
    fakeProducts.count.mockResolvedValue(0);

    await productService.listProducts({
      ...defaultQuery,
      minPrice: 1000,
      maxPrice: 5000,
      minRating: 4,
      city: 'Jakarta',
      sort: 'relevance',
    });

    const expectedFilter = { minPrice: 1000, maxPrice: 5000, minRatingTenths: 40, city: 'Jakarta' };
    expect(fakeProducts.findMany).toHaveBeenCalledWith(expect.objectContaining(expectedFilter), 'relevance', 0, 12);
    expect(fakeProducts.count).toHaveBeenCalledWith(expect.objectContaining(expectedFilter));
  });

  it('rejects minPrice above maxPrice with errors.minPrice', async () => {
    const error = await productService
      .listProducts({ ...defaultQuery, minPrice: 5000, maxPrice: 1000 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toBe('The minimum price cannot be greater than the maximum price.');
    expect((error as ValidationError).errors).toEqual({
      minPrice: 'The minimum price cannot be greater than the maximum price.',
    });
    expect(fakeProducts.findMany).not.toHaveBeenCalled();
  });

  it('accepts minPrice equal to maxPrice', async () => {
    fakeProducts.findMany.mockResolvedValue([]);
    fakeProducts.count.mockResolvedValue(0);

    await expect(
      productService.listProducts({ ...defaultQuery, minPrice: 1000, maxPrice: 1000 }),
    ).resolves.toBeDefined();
  });

  it('breaks price ties by id ascending', async () => {
    fakeProducts.findAll.mockResolvedValue([
      buildProduct(3, 'C', [{ price: 1000 }]),
      buildProduct(1, 'A', [{ price: 1000 }]),
      buildProduct(2, 'B', [{ price: 500 }]),
    ]);

    const asc = await productService.listProducts({ ...defaultQuery, sort: 'price_asc' });
    const desc = await productService.listProducts({ ...defaultQuery, sort: 'price_desc' });

    expect(asc.products.map((p) => p.slug)).toEqual(['b', 'a', 'c']);
    expect(desc.products.map((p) => p.slug)).toEqual(['a', 'c', 'b']);
  });
});

describe('productListQuerySchema', () => {
  const parse = (query: Record<string, string>) => productListQuerySchema.safeParse(query);

  it('parses the new parameters', () => {
    const result = parse({ minPrice: '1000', maxPrice: '5000', minRating: '4', city: '  Jakarta ', sort: 'relevance' });

    expect(result.success && result.data).toMatchObject({
      minPrice: 1000,
      maxPrice: 5000,
      minRating: 4,
      city: 'Jakarta',
      sort: 'relevance',
    });
  });

  it.each(['0', '6', 'abc', '3.5', ''])('rejects minRating "%s"', (value) => {
    expect(parse({ minRating: value }).success).toBe(false);
  });

  it.each(['abc', '-1', '1.5', '', '99999999999'])('rejects minPrice and maxPrice "%s"', (value) => {
    expect(parse({ minPrice: value }).success).toBe(false);
    expect(parse({ maxPrice: value }).success).toBe(false);
  });

  it('accepts a price of 0', () => {
    expect(parse({ minPrice: '0' }).success).toBe(true);
  });

  it.each(['', '   '])('rejects an empty or whitespace-only city "%s"', (value) => {
    expect(parse({ city: value }).success).toBe(false);
  });

  it('rejects unknown query keys', () => {
    expect(parse({ foo: 'bar' }).success).toBe(false);
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
