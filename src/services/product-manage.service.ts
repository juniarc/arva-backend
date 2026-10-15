import { NotFoundError, ValidationError } from '../lib/errors.js';
import { MAX_PRODUCT_IMAGES } from '../lib/image-file.js';
import { removeStoredImages, storeImages } from '../lib/image-storage.js';
import { toImageUrl } from '../lib/imageUrl.js';
import {
  productManageRepository,
  type OwnedProductRecord,
  type ProductManageRepository,
} from '../repositories/product-manage.repository.js';
import type { UpdateProductInput } from '../schemas/product-create.schema.js';
import { applyDiscount, checkImages, normalizeTags, type UploadedImage } from './product-create.service.js';

const PRODUCT_NOT_FOUND = 'Product not found.';
const FIX_FIELDS = 'Please fix the highlighted fields.';

export interface OwnedProductResponse {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  tags: string[];
  discountPercent: number | null;
  // Null for a product listed before the package size was asked.
  shipping: { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number; fee: number } | null;
  // price is the price before the discount, as the seller typed it.
  variants: { id: string; label: string; price: number; stock: number; unit: string }[];
  images: { id: string; url: string }[];
}

// Someone else's product looks exactly like a missing one: nothing about it is revealed.
async function findOwned(repo: ProductManageRepository, userId: number, productId: number): Promise<OwnedProductRecord> {
  const product = await repo.findProduct(productId);
  if (!product || product.shop.ownerId !== userId) {
    throw new NotFoundError(PRODUCT_NOT_FOUND);
  }
  return product;
}

export function toOwnedProductResponse(product: OwnedProductRecord): OwnedProductResponse {
  const { weightGrams, lengthCm, widthCm, heightCm, shippingFee } = product;
  const hasShipping =
    weightGrams !== null && lengthCm !== null && widthCm !== null && heightCm !== null && shippingFee !== null;
  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    description: product.description,
    categoryId: String(product.categoryId),
    tags: product.tags,
    discountPercent: product.discountPercent,
    shipping: hasShipping ? { weightGrams, lengthCm, widthCm, heightCm, fee: shippingFee } : null,
    variants: product.variants.map((variant) => ({
      id: String(variant.id),
      label: variant.label,
      price: variant.originalPrice ?? variant.price,
      stock: variant.stock,
      unit: variant.unit,
    })),
    images: product.images.map((image) => ({ id: String(image.id), url: toImageUrl(image.url) })),
  };
}

async function getOwnedProduct(
  userId: number,
  productId: number,
  repo: ProductManageRepository = productManageRepository,
): Promise<OwnedProductResponse> {
  return toOwnedProductResponse(await findOwned(repo, userId, productId));
}

async function updateProduct(
  userId: number,
  productId: number,
  input: UpdateProductInput,
  uploaded: UploadedImage[],
  repo: ProductManageRepository = productManageRepository,
): Promise<{ id: string; slug: string }> {
  const product = await findOwned(repo, userId, productId);

  // Photos: the kept ones must be this product's, and there must be 1 to 5 in total.
  const existingImages = new Map(product.images.map((image) => [String(image.id), image.url]));
  if (input.keepImageIds.some((id) => !existingImages.has(id))) {
    throw new ValidationError(FIX_FIELDS, { images: 'One of the photos is no longer there. Reload the page.' });
  }
  const keptUrls = [...new Set(input.keepImageIds)].map((id) => existingImages.get(id) ?? '');
  const total = keptUrls.length + uploaded.length;
  if (total === 0) {
    throw new ValidationError(FIX_FIELDS, { images: 'Add at least one photo.' });
  }
  if (total > MAX_PRODUCT_IMAGES) {
    throw new ValidationError(FIX_FIELDS, { images: `Add up to ${MAX_PRODUCT_IMAGES} photos.` });
  }
  const newImages = uploaded.length > 0 ? checkImages(uploaded) : [];

  // Variants: an id must be one of this product's variants.
  const existingVariantIds = new Set(product.variants.map((variant) => String(variant.id)));
  if (input.variants.some((variant) => variant.id !== undefined && !existingVariantIds.has(variant.id))) {
    throw new ValidationError(FIX_FIELDS, { variants: 'One of the variants is no longer there. Reload the page.' });
  }

  const categoryId = Number(input.categoryId);
  if (!(await repo.categoryExists(categoryId))) {
    throw new ValidationError(FIX_FIELDS, { categoryId: 'Choose a category.' });
  }

  const variants = input.variants.map((variant, position) => ({
    id: variant.id,
    label: variant.label,
    unit: variant.unit,
    stock: variant.stock,
    position,
    ...applyDiscount(variant.price, input.discountPercent),
  }));

  const stored = await storeImages(newImages);
  let saved: { id: number; slug: string };
  try {
    saved = await repo.update(productId, {
      name: input.name,
      description: input.description,
      categoryId,
      tags: normalizeTags(input.tags),
      discountPercent: input.discountPercent,
      weightGrams: input.shipping.weightGrams,
      lengthCm: input.shipping.lengthCm,
      widthCm: input.shipping.widthCm,
      heightCm: input.shipping.heightCm,
      shippingFee: input.shipping.fee,
      keptVariants: variants.flatMap(({ id, ...variant }) => (id === undefined ? [] : [{ ...variant, id: Number(id) }])),
      newVariants: variants.flatMap(({ id, ...variant }) => (id === undefined ? [variant] : [])),
      imageUrls: [...keptUrls, ...stored.urls],
    });
  } catch (error) {
    await stored.remove();
    throw error;
  }

  // The photos the seller removed are deleted from disk once the save has gone through.
  const dropped = [...existingImages.values()].filter((url) => !keptUrls.includes(url));
  await removeStoredImages(dropped);
  return { id: String(saved.id), slug: saved.slug };
}

async function deleteProduct(
  userId: number,
  productId: number,
  repo: ProductManageRepository = productManageRepository,
): Promise<void> {
  const product = await findOwned(repo, userId, productId);
  await repo.remove(productId);
  await removeStoredImages(product.images.map((image) => image.url));
}

export const productManageService = { getOwnedProduct, updateProduct, deleteProduct };
