import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// The owner's view of one product: everything the edit form needs. ownerId is read only to check
// who is asking; it is never returned.
const ownedProductSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  categoryId: true,
  tags: true,
  discountPercent: true,
  weightGrams: true,
  lengthCm: true,
  widthCm: true,
  heightCm: true,
  shippingFee: true,
  shop: { select: { ownerId: true } },
  variants: {
    select: { id: true, label: true, unit: true, price: true, originalPrice: true, stock: true, position: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  },
  images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.ProductSelect;

export type OwnedProductRecord = Prisma.ProductGetPayload<{ select: typeof ownedProductSelect }>;

export interface ProductUpdateData {
  name: string;
  description: string;
  categoryId: number;
  tags: string[];
  discountPercent: number | null;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  shippingFee: number;
  // Existing variants to keep (updated), in order. The others are deleted.
  keptVariants: { id: number; label: string; unit: string; price: number; originalPrice: number | null; stock: number; position: number }[];
  newVariants: { label: string; unit: string; price: number; originalPrice: number | null; stock: number; position: number }[];
  // Every photo of the product after the save, in order. The first one is the main photo.
  imageUrls: string[];
}

export const productManageRepository = {
  // The product, or null when it does not exist. The service checks the owner.
  findProduct(id: number): Promise<OwnedProductRecord | null> {
    return prisma.product.findUnique({ where: { id }, select: ownedProductSelect });
  },

  async categoryExists(id: number): Promise<boolean> {
    return (await prisma.category.count({ where: { id } })) > 0;
  },

  // Everything in one transaction: the product is never half saved.
  async update(productId: number, data: ProductUpdateData): Promise<{ id: number; slug: string }> {
    const { keptVariants, newVariants, imageUrls, ...fields } = data;
    return prisma.$transaction(async (tx) => {
      const keptIds = keptVariants.map((variant) => variant.id);
      // Removing a variant also removes the cart items that hold it (cascade).
      await tx.productVariant.deleteMany({ where: { productId, id: { notIn: keptIds } } });
      // Labels are unique per product. Two kept variants can swap labels, so every kept label is
      // first set to a temporary one, then to its final value.
      for (const variant of keptVariants) {
        await tx.productVariant.update({ where: { id: variant.id }, data: { label: `__saving_${variant.id}` } });
      }
      for (const { id, ...variant } of keptVariants) {
        await tx.productVariant.update({ where: { id }, data: variant });
      }
      if (newVariants.length > 0) {
        await tx.productVariant.createMany({ data: newVariants.map((variant) => ({ ...variant, productId })) });
      }

      // Photos have nothing pointing at them, so the simplest correct order is: remove all, add back.
      await tx.productImage.deleteMany({ where: { productId } });
      await tx.productImage.createMany({
        data: imageUrls.map((url, position) => ({ productId, url, alt: fields.name, position })),
      });

      return tx.product.update({
        where: { id: productId },
        data: { ...fields, imageUrl: imageUrls[0] ?? '' },
        select: { id: true, slug: true },
      });
    });
  },

  // Removes the product. Its variants, photos, reviews, wishlist entries, cart items and the
  // checkout lines of those cart items go with it (all cascade in the schema).
  async remove(productId: number): Promise<void> {
    await prisma.product.delete({ where: { id: productId } });
  },
};

export type ProductManageRepository = typeof productManageRepository;
