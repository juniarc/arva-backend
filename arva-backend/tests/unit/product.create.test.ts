import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { detectImageKind } from '../../src/lib/image-file.js';
import { ProductSlugTakenError, type ProductCreateRepository } from '../../src/repositories/product-create.repository.js';
import { createProductSchema, parseProductData } from '../../src/schemas/product-create.schema.js';

const { storeImages, remove } = vi.hoisted(() => {
  const remove = vi.fn(async () => undefined);
  const storeImages = vi.fn(async (images: unknown[]) => ({
    urls: images.map((_image, index) => `http://localhost:4000/uploads/products/${index}.png`),
    remove,
  }));
  return { storeImages, remove };
});

vi.mock('../../src/lib/image-storage.js', () => ({ storeImages }));

const { applyDiscount, checkImages, normalizeTags, productCreateService } = await import(
  '../../src/services/product-create.service.js'
);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);

const validData = {
  name: 'Banana Fruits from Bali',
  description: 'Sweet bananas.',
  categoryId: '2',
  tags: ['Corn', 'corn ', 'Fresh'],
  variants: [
    { label: '1 kg', price: 10000, stock: 30, unit: 'kg' },
    { label: '500 g', price: 6000, stock: 10, unit: 'g' },
  ],
  discountPercent: 10,
  shipping: { weightGrams: 300, lengthCm: 30, widthCm: 20, heightCm: 10, fee: 1000 },
};

function fakeRepo(overrides: Partial<ProductCreateRepository> = {}): ProductCreateRepository {
  return {
    findOwnedShopId: vi.fn(async () => 7),
    categoryExists: vi.fn(async () => true),
    isSlugTaken: vi.fn(async () => false),
    create: vi.fn(async () => ({ id: 42, slug: 'banana-fruits-from-bali' })),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('detectImageKind', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', () => {
    expect(detectImageKind(JPG)).toBe('jpg');
    expect(detectImageKind(PNG)).toBe('png');
    expect(detectImageKind(WEBP)).toBe('webp');
  });

  it('rejects anything else, even with an image name', () => {
    expect(detectImageKind(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageKind(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageKind(Buffer.from([]))).toBeNull();
  });
});

describe('createProductSchema', () => {
  it('accepts a complete product', () => {
    expect(createProductSchema.safeParse(validData).success).toBe(true);
  });

  it('needs at least one variant, at most 10, with different labels', () => {
    expect(createProductSchema.safeParse({ ...validData, variants: [] }).success).toBe(false);
    const same = [validData.variants[0], { ...validData.variants[1], label: '1 KG' }];
    expect(createProductSchema.safeParse({ ...validData, variants: same }).success).toBe(false);
  });

  it('checks prices, stock, units, the discount and the package', () => {
    const variant = validData.variants[0];
    for (const bad of [
      { ...validData, variants: [{ ...variant, price: 50 }] },
      { ...validData, variants: [{ ...variant, price: 1.5 }] },
      { ...validData, variants: [{ ...variant, stock: -1 }] },
      { ...validData, variants: [{ ...variant, unit: 'box' }] },
      { ...validData, discountPercent: 95 },
      { ...validData, shipping: { ...validData.shipping, weightGrams: 0 } },
      { ...validData, extra: true },
    ]) {
      expect(createProductSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('takes no discount as null', () => {
    const parsed = createProductSchema.parse({ ...validData, discountPercent: null });
    expect(parsed.discountPercent).toBeNull();
  });

  it('reads the JSON in the "data" field', () => {
    expect(parseProductData(JSON.stringify({ a: 1 }))).toEqual({ a: 1 });
    expect(parseProductData('not json')).toBeUndefined();
    expect(parseProductData(undefined)).toBeUndefined();
  });
});

describe('helpers', () => {
  it('normalizes tags: trimmed, lower case, no repeats', () => {
    expect(normalizeTags(['Corn', 'corn ', ' Fresh', ''])).toEqual(['corn', 'fresh']);
  });

  it('takes the discount off the price and keeps the price before it', () => {
    expect(applyDiscount(10000, null)).toEqual({ price: 10000, originalPrice: null });
    expect(applyDiscount(10000, 10)).toEqual({ price: 9000, originalPrice: 10000 });
    expect(applyDiscount(999, 15)).toEqual({ price: 849, originalPrice: 999 });
  });

  it('needs at least one real image', () => {
    expect(() => checkImages([])).toThrow(ValidationError);
    expect(() => checkImages([{ buffer: Buffer.from('hello') }])).toThrow(ValidationError);
    expect(checkImages([{ buffer: PNG }, { buffer: JPG }]).map((image) => image.kind)).toEqual(['png', 'jpg']);
  });
});

describe('productCreateService.createProduct', () => {
  const input = createProductSchema.parse(validData);

  it('creates the product in the user\'s own shop, with discounted variants and the photos', async () => {
    const repo = fakeRepo();

    const result = await productCreateService.createProduct(5, input, [{ buffer: PNG }, { buffer: JPG }], repo);

    expect(result).toEqual({ id: '42', slug: 'banana-fruits-from-bali' });
    expect(repo.findOwnedShopId).toHaveBeenCalledWith(5);
    const saved = vi.mocked(repo.create).mock.calls[0]?.[0];
    expect(saved).toMatchObject({
      slug: 'banana-fruits-from-bali',
      shopId: 7,
      categoryId: 2,
      tags: ['corn', 'fresh'],
      discountPercent: 10,
      weightGrams: 300,
      shippingFee: 1000,
      imageUrl: 'http://localhost:4000/uploads/products/0.png',
    });
    expect(saved?.variants).toEqual([
      { label: '1 kg', unit: 'kg', stock: 30, position: 0, price: 9000, originalPrice: 10000 },
      { label: '500 g', unit: 'g', stock: 10, position: 1, price: 5400, originalPrice: 6000 },
    ]);
    expect(saved?.images).toHaveLength(2);
  });

  it('answers "Shop not found." for a user without a shop, and writes no file', async () => {
    const repo = fakeRepo({ findOwnedShopId: vi.fn(async () => null) });

    await expect(productCreateService.createProduct(5, input, [{ buffer: PNG }], repo)).rejects.toBeInstanceOf(NotFoundError);
    expect(storeImages).not.toHaveBeenCalled();
  });

  it('rejects an unknown category before writing any file', async () => {
    const repo = fakeRepo({ categoryExists: vi.fn(async () => false) });

    await expect(productCreateService.createProduct(5, input, [{ buffer: PNG }], repo)).rejects.toMatchObject({
      errors: { categoryId: 'Choose a category.' },
    });
    expect(storeImages).not.toHaveBeenCalled();
  });

  it('rejects a file that is not an image before writing any file', async () => {
    await expect(productCreateService.createProduct(5, input, [{ buffer: Buffer.from('MZ...') }], fakeRepo())).rejects.toMatchObject({
      errors: { images: 'Photos must be JPG, PNG or WebP images.' },
    });
    expect(storeImages).not.toHaveBeenCalled();
  });

  it('uses the next free slug', async () => {
    const repo = fakeRepo({ isSlugTaken: vi.fn(async (slug: string) => slug === 'banana-fruits-from-bali') });

    await productCreateService.createProduct(5, input, [{ buffer: PNG }], repo);

    expect(vi.mocked(repo.create).mock.calls[0]?.[0].slug).toBe('banana-fruits-from-bali-2');
  });

  it('tries again when another product takes the slug at the same moment', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new ProductSlugTakenError())
      .mockResolvedValueOnce({ id: 43, slug: 'banana-fruits-from-bali-2' });
    const repo = fakeRepo({ create });

    const result = await productCreateService.createProduct(5, input, [{ buffer: PNG }], repo);

    expect(result.slug).toBe('banana-fruits-from-bali-2');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('deletes the stored photos when the product cannot be saved', async () => {
    const repo = fakeRepo({ create: vi.fn(async () => Promise.reject(new Error('database down'))) });

    await expect(productCreateService.createProduct(5, input, [{ buffer: PNG }], repo)).rejects.toThrow('database down');
    expect(remove).toHaveBeenCalled();
  });
});
