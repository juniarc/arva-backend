import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface NewProductData {
  slug: string;
  name: string;
  description: string;
  categoryId: number;
  shopId: number;
  imageUrl: string;
  tags: string[];
  discountPercent: number | null;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  shippingFee: number;
  variants: { label: string; unit: string; price: number; originalPrice: number | null; stock: number; position: number }[];
  images: { url: string; alt: string; position: number }[];
}

// A product slug that another product took between the check and the insert.
export class ProductSlugTakenError extends Error {
  constructor() {
    super('Product slug is taken.');
    this.name = 'ProductSlugTakenError';
  }
}

export const productCreateRepository = {
  async findOwnedShopId(userId: number): Promise<number | null> {
    const shop = await prisma.shop.findUnique({ where: { ownerId: userId }, select: { id: true } });
    return shop?.id ?? null;
  },

  async categoryExists(id: number): Promise<boolean> {
    return (await prisma.category.count({ where: { id } })) > 0;
  },

  async isSlugTaken(slug: string): Promise<boolean> {
    return (await prisma.product.count({ where: { slug } })) > 0;
  },

  // The product, its variants and its images in one write: all or nothing.
  async create(data: NewProductData): Promise<{ id: number; slug: string }> {
    const { variants, images, ...product } = data;
    try {
      return await prisma.product.create({
        data: { ...product, variants: { create: variants }, images: { create: images } },
        select: { id: true, slug: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (JSON.stringify(error.meta?.target ?? '').includes('slug')) {
          throw new ProductSlugTakenError();
        }
      }
      throw error;
    }
  },
};

export type ProductCreateRepository = typeof productCreateRepository;
