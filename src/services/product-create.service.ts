import { NotFoundError, ValidationError } from '../lib/errors.js';
import { detectImageKind, type ImageKind } from '../lib/image-file.js';
import { storeImages } from '../lib/image-storage.js';
import { slugCandidate, slugify } from '../lib/slug.js';
import {
  productCreateRepository,
  ProductSlugTakenError,
  type ProductCreateRepository,
} from '../repositories/product-create.repository.js';
import type { CreateProductInput } from '../schemas/product-create.schema.js';

export interface UploadedImage {
  buffer: Buffer;
}

const MAX_SLUG_ATTEMPTS = 20;
const FIX_FIELDS = 'Please fix the highlighted fields.';

// Tags are stored in lower case, without repeats, in the order the seller typed them.
export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

// The discount is taken off every variant. The price before it is kept as originalPrice, so the
// product list shows the discount like any other. A price never drops below 1.
export function applyDiscount(
  price: number,
  discountPercent: number | null,
): { price: number; originalPrice: number | null } {
  if (discountPercent === null) {
    return { price, originalPrice: null };
  }
  return { price: Math.max(1, Math.round((price * (100 - discountPercent)) / 100)), originalPrice: price };
}

// Every photo must really be a JPEG, PNG or WebP file: its first bytes decide, not its name.
export function checkImages(images: UploadedImage[]): { bytes: Buffer; kind: ImageKind }[] {
  if (images.length === 0) {
    throw new ValidationError(FIX_FIELDS, { images: 'Add at least one photo.' });
  }
  return images.map((image) => {
    const kind = detectImageKind(image.buffer);
    if (!kind) {
      throw new ValidationError(FIX_FIELDS, { images: 'Photos must be JPG, PNG or WebP images.' });
    }
    return { bytes: image.buffer, kind };
  });
}

async function findFreeSlug(repo: ProductCreateRepository, name: string, from: number): Promise<string> {
  const base = slugify(name);
  for (let attempt = from; attempt < from + MAX_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = slugCandidate(base, attempt);
    if (!(await repo.isSlugTaken(candidate))) {
      return candidate;
    }
  }
  return `${base}-${Date.now()}`;
}

// The owner is the verified user: a product is always created in the user's own shop.
async function createProduct(
  userId: number,
  input: CreateProductInput,
  uploaded: UploadedImage[],
  repo: ProductCreateRepository = productCreateRepository,
): Promise<{ id: string; slug: string }> {
  const shopId = await repo.findOwnedShopId(userId);
  if (shopId === null) {
    throw new NotFoundError('Shop not found.');
  }

  const images = checkImages(uploaded);
  const categoryId = Number(input.categoryId);
  if (!(await repo.categoryExists(categoryId))) {
    throw new ValidationError(FIX_FIELDS, { categoryId: 'Choose a category.' });
  }

  // Files are written only after every check passed, and removed again if the product is not saved.
  const stored = await storeImages(images);
  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const created = await repo.create({
          slug: await findFreeSlug(repo, input.name, attempt),
          name: input.name,
          description: input.description,
          categoryId,
          shopId,
          imageUrl: stored.urls[0] ?? '',
          tags: normalizeTags(input.tags),
          discountPercent: input.discountPercent,
          weightGrams: input.shipping.weightGrams,
          lengthCm: input.shipping.lengthCm,
          widthCm: input.shipping.widthCm,
          heightCm: input.shipping.heightCm,
          shippingFee: input.shipping.fee,
          variants: input.variants.map((variant, position) => ({
            label: variant.label,
            unit: variant.unit,
            stock: variant.stock,
            position,
            ...applyDiscount(variant.price, input.discountPercent),
          })),
          images: stored.urls.map((url, position) => ({ url, alt: input.name, position })),
        });
        return { id: String(created.id), slug: created.slug };
      } catch (error) {
        // Another product took the slug at the same moment: try the next one.
        if (error instanceof ProductSlugTakenError && attempt < 3) {
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    await stored.remove();
    throw error;
  }
}

export const productCreateService = { createProduct };
