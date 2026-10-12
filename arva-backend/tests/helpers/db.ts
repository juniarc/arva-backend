import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/lib/prisma.js';

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.cartItem.deleteMany(),
    prisma.review.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.shop.deleteMany(),
    prisma.category.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

interface FixtureVariant {
  label: string;
  price: number;
  originalPrice?: number;
  stock: number;
  position: number;
}

interface FixtureProduct {
  slug: string;
  category: string;
  shop: string;
  soldCount: number;
  isActive?: boolean;
  variants: FixtureVariant[];
}

// A small, fixed dataset:
//   shops-name ("Shop's Name", Jakarta): bali-banana-fruit, cucumber, hidden (inactive)
//   shop-b ("Shop B", Kab. B):           mango, sprayer
//
//   bali-banana-fruit (fruits, 500 sold):  "1 kg" 1000 (was 1250) stock 10 position 0,
//                                          "2 kg" 1900 stock 5 position 1.
//                                          The "2 kg" variant is created first, so position
//                                          (not creation order) decides the order.
//   mango (fruits, 300 sold):              "1 kg" 2000 stock 0
//   cucumber (vegetables, 100):            "1 kg" 500 stock 20
//   sprayer (equipments, 50):              "2 L" 3000 (was 3500) stock 3
//   hidden (fruits, INACTIVE):             "1 kg" 100 stock 50
// Lowest prices, cheapest first: cucumber 500, bali-banana-fruit 1000, mango 2000, sprayer 3000.
const fixtureProducts: FixtureProduct[] = [
  {
    slug: 'bali-banana-fruit',
    category: 'fruits',
    shop: 'shops-name',
    soldCount: 500,
    variants: [
      { label: '2 kg', price: 1900, stock: 5, position: 1 },
      { label: '1 kg', price: 1000, originalPrice: 1250, stock: 10, position: 0 },
    ],
  },
  {
    slug: 'mango',
    category: 'fruits',
    shop: 'shop-b',
    soldCount: 300,
    variants: [{ label: '1 kg', price: 2000, stock: 0, position: 0 }],
  },
  {
    slug: 'cucumber',
    category: 'vegetables',
    shop: 'shops-name',
    soldCount: 100,
    variants: [{ label: '1 kg', price: 500, stock: 20, position: 0 }],
  },
  {
    slug: 'sprayer',
    category: 'equipments',
    shop: 'shop-b',
    soldCount: 50,
    variants: [{ label: '2 L', price: 3000, originalPrice: 3500, stock: 3, position: 0 }],
  },
  {
    slug: 'hidden',
    category: 'fruits',
    shop: 'shops-name',
    soldCount: 9999,
    isActive: false,
    variants: [{ label: '1 kg', price: 100, stock: 50, position: 0 }],
  },
];

const DAY = 24 * 60 * 60 * 1000;

export interface Fixtures {
  // Variant ids by "product-slug/label", for example "bali-banana-fruit/1 kg".
  variantIds: Record<string, number>;
  // Product ids by slug.
  productIds: Record<string, number>;
}

export async function seedFixtures(): Promise<Fixtures> {
  const categoryNames = ['seeds', 'vegetables', 'fruits', 'fertilizers', 'equipments'];
  const categoryIds: Record<string, number> = {};
  for (const [index, slug] of categoryNames.entries()) {
    const category = await prisma.category.create({
      data: { slug, name: slug[0]?.toUpperCase() + slug.slice(1), iconKey: slug, sortOrder: index + 1 },
    });
    categoryIds[slug] = category.id;
  }

  const shopA = await prisma.shop.create({
    data: {
      slug: 'shops-name',
      name: "Shop's Name",
      city: 'Jakarta',
      logoUrl: '/images/dummy/shop-logo-placeholder.jpg',
      ratingTenths: 34,
      ratingCount: 212,
    },
  });
  const shopB = await prisma.shop.create({ data: { slug: 'shop-b', name: 'Shop B', city: 'Kab. B' } });
  const shopIds: Record<string, number> = { 'shops-name': shopA.id, 'shop-b': shopB.id };

  const variantIds: Record<string, number> = {};
  const productIds: Record<string, number> = {};
  for (const item of fixtureProducts) {
    const isBanana = item.slug === 'bali-banana-fruit';
    const product = await prisma.product.create({
      data: {
        slug: item.slug,
        name: item.slug,
        description: isBanana ? 'Banana Fruit from Bali, Indonesia.' : '',
        categoryId: categoryIds[item.category] ?? 0,
        shopId: shopIds[item.shop] ?? 0,
        imageUrl: `/images/dummy/${item.slug}.jpg`,
        ratingTenths: 34,
        ratingCount: isBanana ? 212 : 0,
        reviewCount: isBanana ? 104 : 0,
        soldCount: item.soldCount,
        isActive: item.isActive ?? true,
        variants: {
          create: item.variants.map((variant) => ({
            label: variant.label,
            unit: 'kg',
            price: variant.price,
            originalPrice: variant.originalPrice ?? null,
            stock: variant.stock,
            position: variant.position,
          })),
        },
      },
      include: { variants: true },
    });
    productIds[item.slug] = product.id;
    for (const variant of product.variants) {
      variantIds[`${item.slug}/${variant.label}`] = variant.id;
    }
  }

  // Six images for the banana, created out of order so position decides the order.
  const bananaId = productIds['bali-banana-fruit'] ?? 0;
  for (const position of [3, 1, 6, 2, 5, 4]) {
    await prisma.productImage.create({
      data: {
        productId: bananaId,
        position,
        url: `/images/dummy/bali-banana-fruit-${position}.jpg`,
        alt: `bali-banana-fruit image ${position}`,
      },
    });
  }

  // Three visible reviews (7, 8 and 10 days old) and one hidden review.
  const now = Date.now();
  await prisma.review.createMany({
    data: [
      { productId: bananaId, authorName: 'username', authorAvatarUrl: '/images/dummy/avatar-1.jpg', rating: 3, text: 'Third', createdAt: new Date(now - 10 * DAY) },
      { productId: bananaId, authorName: 'username', authorAvatarUrl: '/images/dummy/avatar-1.jpg', rating: 4, text: 'First', createdAt: new Date(now - 7 * DAY) },
      { productId: bananaId, authorName: 'username', authorAvatarUrl: null, rating: 4, text: 'Second', createdAt: new Date(now - 8 * DAY) },
      { productId: bananaId, authorName: 'hidden user', rating: 1, text: 'Hidden', createdAt: new Date(now - 1 * DAY), isVisible: false },
    ],
  });

  await prisma.banner.createMany({
    data: [
      { type: 'CAROUSEL', position: 2, title: 'Carousel 2', imageUrl: '/c2.jpg' },
      { type: 'CAROUSEL', position: 1, title: 'Carousel 1', subtitle: 'Sub', buttonLabel: 'Go', linkUrl: '/products', imageUrl: '/c1.jpg' },
      { type: 'CAROUSEL', position: 3, title: 'Inactive', imageUrl: '/c3.jpg', isActive: false },
      { type: 'PROMO_STRIP', position: 1, title: 'Promo', imageUrl: '/p1.jpg' },
      { type: 'SIDE_BANNER', position: 1, title: 'Side', imageUrl: '/s1.jpg' },
      { type: 'VERTICAL_BANNER', position: 1, title: 'Vertical', imageUrl: '/v1.jpg' },
    ],
  });

  return { variantIds, productIds };
}

// Registers a user through the API and returns their token.
export async function registerAndLogin(app: Express, username: string): Promise<string> {
  const password = 'secret123';
  await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@example.com`, password })
    .expect(201);
  const res = await request(app).post('/api/auth/login').send({ username, password }).expect(200);
  return res.body.access_token as string;
}
