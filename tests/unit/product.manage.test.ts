import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/errors.js';
import type { OwnedProductRecord, ProductManageRepository } from '../../src/repositories/product-manage.repository.js';
import { updateProductSchema } from '../../src/schemas/product-create.schema.js';

const { storeImages, removeStoredImages, removeNew } = vi.hoisted(() => {
  const removeNew = vi.fn(async () => undefined);
  const storeImages = vi.fn(async (images: unknown[]) => ({
    urls: images.map((_image, index) => `http://localhost:4000/uploads/products/new-${index}.png`),
    remove: removeNew,
  }));
  const removeStoredImages = vi.fn(async () => undefined);
  return { storeImages, removeStoredImages, removeNew };
});

vi.mock('../../src/lib/image-storage.js', () => ({ storeImages, removeStoredImages }));

const { productManageService, toOwnedProductResponse } = await import('../../src/services/product-manage.service.js');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const OWNER = 5;

function record(overrides: Partial<OwnedProductRecord> = {}): OwnedProductRecord {
  return {
    id: 42,
    slug: 'banana',
    name: 'Banana',
    description: 'Sweet.',
    categoryId: 2,
    tags: ['corn'],
    discountPercent: 10,
    weightGrams: 300,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 10,
    shippingFee: 1000,
    shop: { ownerId: OWNER },
    variants: [
      { id: 1, label: '1 kg', unit: 'kg', price: 9000, originalPrice: 10000, stock: 3, position: 0 },
      { id: 2, label: '500 g', unit: 'g', price: 5400, originalPrice: 6000, stock: 5, position: 1 },
    ],
    images: [
      { id: 11, url: 'http://localhost:4000/uploads/products/a.png', position: 0 },
      { id: 12, url: 'http://localhost:4000/uploads/products/b.png', position: 1 },
    ],
    ...overrides,
  };
}

function fakeRepo(product: OwnedProductRecord | null = record()): ProductManageRepository {
  return {
    findProduct: vi.fn(async () => product),
    categoryExists: vi.fn(async () => true),
    update: vi.fn(async () => ({ id: 42, slug: 'banana' })),
    remove: vi.fn(async () => undefined),
  };
}

const update = (overrides: Record<string, unknown> = {}) =>
  updateProductSchema.parse({
    name: 'Banana',
    description: 'Sweet.',
    categoryId: '2',
    tags: ['Corn'],
    variants: [
      { id: '1', label: '1 kg', price: 10000, stock: 3, unit: 'kg' },
      { label: '2 kg', price: 18000, stock: 1, unit: 'kg' },
    ],
    discountPercent: null,
    shipping: { weightGrams: 300, lengthCm: 30, widthCm: 20, heightCm: 10, fee: 1000 },
    keepImageIds: ['12'],
    ...overrides,
  });

beforeEach(() => vi.clearAllMocks());

describe('toOwnedProductResponse', () => {
  it('gives the edit form the prices before the discount, and ids as strings', () => {
    const response = toOwnedProductResponse(record());
    expect(response.variants[0]).toEqual({ id: '1', label: '1 kg', price: 10000, stock: 3, unit: 'kg' });
    expect(response.categoryId).toBe('2');
    expect(response.shipping).toEqual({ weightGrams: 300, lengthCm: 30, widthCm: 20, heightCm: 10, fee: 1000 });
    expect(response.images.map((image) => image.id)).toEqual(['11', '12']);
  });

  it('has no shipping for a product listed before the package size was asked', () => {
    expect(toOwnedProductResponse(record({ weightGrams: null })).shipping).toBeNull();
  });
});

describe('only the owner', () => {
  it('another user gets "Product not found." for read, update and delete, and nothing changes', async () => {
    const repo = fakeRepo();
    await expect(productManageService.getOwnedProduct(99, 42, repo)).rejects.toBeInstanceOf(NotFoundError);
    await expect(productManageService.updateProduct(99, 42, update(), [], repo)).rejects.toBeInstanceOf(NotFoundError);
    await expect(productManageService.deleteProduct(99, 42, repo)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('a missing product is "Product not found."', async () => {
    await expect(productManageService.getOwnedProduct(OWNER, 42, fakeRepo(null))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('productManageService.updateProduct', () => {
  it('keeps, updates and adds variants, keeps and adds photos, and removes the dropped photo from disk', async () => {
    const repo = fakeRepo();

    const result = await productManageService.updateProduct(OWNER, 42, update(), [{ buffer: PNG }], repo);

    expect(result).toEqual({ id: '42', slug: 'banana' });
    const saved = vi.mocked(repo.update).mock.calls[0]?.[1];
    expect(saved?.keptVariants).toEqual([{ id: 1, label: '1 kg', unit: 'kg', stock: 3, position: 0, price: 10000, originalPrice: null }]);
    expect(saved?.newVariants).toEqual([{ label: '2 kg', unit: 'kg', stock: 1, position: 1, price: 18000, originalPrice: null }]);
    expect(saved?.imageUrls).toEqual(['http://localhost:4000/uploads/products/b.png', 'http://localhost:4000/uploads/products/new-0.png']);
    expect(saved?.tags).toEqual(['corn']);
    expect(removeStoredImages).toHaveBeenCalledWith(['http://localhost:4000/uploads/products/a.png']);
  });

  it('applies the discount to every variant', async () => {
    const repo = fakeRepo();
    await productManageService.updateProduct(OWNER, 42, update({ discountPercent: 10 }), [], repo);
    const saved = vi.mocked(repo.update).mock.calls[0]?.[1];
    expect(saved?.keptVariants[0]).toMatchObject({ price: 9000, originalPrice: 10000 });
  });

  it('needs at least one photo, and at most 5', async () => {
    await expect(productManageService.updateProduct(OWNER, 42, update({ keepImageIds: [] }), [], fakeRepo())).rejects.toMatchObject({
      errors: { images: 'Add at least one photo.' },
    });
    const six = Array.from({ length: 5 }, () => ({ buffer: PNG }));
    await expect(productManageService.updateProduct(OWNER, 42, update(), six, fakeRepo())).rejects.toMatchObject({
      errors: { images: 'Add up to 5 photos.' },
    });
  });

  it("rejects a photo or a variant that is not this product's", async () => {
    await expect(productManageService.updateProduct(OWNER, 42, update({ keepImageIds: ['999'] }), [], fakeRepo())).rejects.toMatchObject({
      errors: { images: expect.any(String) },
    });
    const variants = [{ id: '999', label: '1 kg', price: 10000, stock: 3, unit: 'kg' }];
    await expect(productManageService.updateProduct(OWNER, 42, update({ variants }), [], fakeRepo())).rejects.toMatchObject({
      errors: { variants: expect.any(String) },
    });
  });

  it('deletes the new photos again when the save fails, and keeps the old ones', async () => {
    const repo = fakeRepo();
    vi.mocked(repo.update).mockRejectedValue(new Error('database down'));

    await expect(productManageService.updateProduct(OWNER, 42, update(), [{ buffer: PNG }], repo)).rejects.toThrow('database down');
    expect(removeNew).toHaveBeenCalled();
    expect(removeStoredImages).not.toHaveBeenCalled();
  });
});

describe('productManageService.deleteProduct', () => {
  it("removes the product and then its photos from disk", async () => {
    const repo = fakeRepo();

    await productManageService.deleteProduct(OWNER, 42, repo);

    expect(repo.remove).toHaveBeenCalledWith(42);
    expect(removeStoredImages).toHaveBeenCalledWith([
      'http://localhost:4000/uploads/products/a.png',
      'http://localhost:4000/uploads/products/b.png',
    ]);
  });
});
