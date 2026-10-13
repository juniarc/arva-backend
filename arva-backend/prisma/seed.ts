// Loads the dummy catalog. Safe to run many times: every row is upserted by its unique key.
// It does not create users, drafts or addresses (users are created through the API only).
import { PrismaClient } from '@prisma/client';
import { banners, categories, products, shops } from './data/dummy-products.js';
import { seedRegions } from './data/regions.js';
import { IMAGES_PER_PRODUCT, productDetails } from './data/dummy-product-detail.js';

const prisma = new PrismaClient();

async function seedCategories(): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const category of categories) {
    const { slug, ...fields } = category;
    const saved = await prisma.category.upsert({
      where: { slug },
      create: category,
      update: fields,
    });
    ids.set(slug, saved.id);
  }
  return ids;
}

async function seedShops(): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const shop of shops) {
    // ownerId is left out on purpose: seeded shops have no owner.
    const { slug, ...fields } = shop;
    const saved = await prisma.shop.upsert({
      where: { slug },
      create: shop,
      update: fields,
    });
    ids.set(shop.slug, saved.id);
  }
  return ids;
}

function lookup(ids: Map<string, number>, slug: string, kind: string): number {
  const id = ids.get(slug);
  if (id === undefined) {
    throw new Error(`Seed data refers to an unknown ${kind}: ${slug}`);
  }
  return id;
}

interface ProductCounts {
  variants: number;
  images: number;
  reviews: number;
}

async function seedProducts(
  categoryIds: Map<string, number>,
  shopIds: Map<string, number>,
): Promise<ProductCounts> {
  const counts: ProductCounts = { variants: 0, images: 0, reviews: 0 };

  for (const product of products) {
    const detail = productDetails[product.slug];
    if (!detail) {
      throw new Error(`No detail seed data for product: ${product.slug}`);
    }

    const fields = {
      name: product.name,
      description: detail.description,
      ratingCount: detail.ratingCount,
      reviewCount: detail.reviewCount,
      categoryId: lookup(categoryIds, product.categorySlug, 'category'),
      shopId: lookup(shopIds, product.shopSlug, 'shop'),
      imageUrl: product.imageUrl,
      ratingTenths: Math.round(product.rating * 10),
      soldCount: product.soldCount,
      isActive: true,
    };
    const saved = await prisma.product.upsert({
      where: { slug: product.slug },
      create: { slug: product.slug, ...fields },
      update: fields,
    });

    for (const [index, variant] of product.variants.entries()) {
      const variantFields = { ...variant, position: index };
      await prisma.productVariant.upsert({
        where: { productId_label: { productId: saved.id, label: variant.label } },
        create: { productId: saved.id, ...variantFields },
        update: variantFields,
      });
      counts.variants += 1;
    }

    // The gallery has IMAGES_PER_PRODUCT slots. Every slot shows the product photo for now,
    // because only one real photo per product exists. Replace the urls when more photos exist.
    for (let position = 1; position <= IMAGES_PER_PRODUCT; position++) {
      const imageFields = { url: product.imageUrl, alt: `${product.name} image ${position}` };
      await prisma.productImage.upsert({
        where: { productId_position: { productId: saved.id, position } },
        create: { productId: saved.id, position, ...imageFields },
        update: imageFields,
      });
      counts.images += 1;
    }

    // Reviews have no natural unique key, so seeded reviews (userId null) are replaced as a
    // group. Reviews written by real users are never touched.
    const now = Date.now();
    await prisma.$transaction([
      prisma.review.deleteMany({ where: { productId: saved.id, userId: null } }),
      prisma.review.createMany({
        data: detail.reviews.map((review) => ({
          productId: saved.id,
          authorName: review.authorName,
          authorAvatarUrl: review.authorAvatarUrl,
          rating: review.rating,
          text: review.text,
          createdAt: new Date(now - review.daysAgo * 24 * 60 * 60 * 1000),
        })),
      }),
    ]);
    counts.reviews += detail.reviews.length;
  }

  return counts;
}

async function seedBanners(): Promise<void> {
  for (const banner of banners) {
    const { type, position, ...fields } = banner;
    await prisma.banner.upsert({
      where: { type_position: { type, position } },
      create: banner,
      update: { ...fields, isActive: true },
    });
  }
}

async function main(): Promise<void> {
  const categoryIds = await seedCategories();
  const shopIds = await seedShops();
  const counts = await seedProducts(categoryIds, shopIds);
  await seedBanners();
  const regionCounts = await seedRegions(prisma);

  console.log('Seed finished:');
  console.log(`  categories: ${categories.length}`);
  console.log(`  shops:      ${shops.length}`);
  console.log(`  products:   ${products.length}`);
  console.log(`  variants:   ${counts.variants}`);
  console.log(`  images:     ${counts.images}`);
  console.log(`  reviews:    ${counts.reviews}`);
  console.log(`  banners:    ${banners.length}`);
  console.log(`  provinces:     ${regionCounts.provinces}`);
  console.log(`  cities:        ${regionCounts.cities}`);
  console.log(`  districts:     ${regionCounts.districts}`);
  console.log(`  sub-districts: ${regionCounts.subDistricts}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
