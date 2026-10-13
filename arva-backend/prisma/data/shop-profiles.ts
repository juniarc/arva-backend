import type { PrismaClient } from '@prisma/client';

// Short descriptions for the seeded shops, keyed by slug.
export const shopDescriptions: Record<string, string> = {
  'shops-name': 'A neighbourhood shop for fresh fruit and vegetables. Open every day.',
  'bali-fresh-farm': 'Fruit grown on our own farm in Badung, Bali. Picked fresh and packed the same day.',
  'java-harvest': 'Seasonal fruit and vegetables from small farms around Bandung.',
  'green-valley-store': 'Apples and other fruit from the highlands of Malang.',
  'tani-makmur': 'Seeds, fertilizer and farming tools for home gardens and small farms.',
  'agro-sentosa': 'Garden equipment and plant care supplies from Garut.',
};

export const DEFAULT_OPENING_TIME = '09:00';
export const DEFAULT_CLOSING_TIME = '19:00';

// Safe to run many times. It only fills values that are still empty, so it never overwrites
// what an owner saved. It does not touch owners, contact details or addresses.
export async function seedShopProfiles(prisma: PrismaClient): Promise<number> {
  for (const [slug, description] of Object.entries(shopDescriptions)) {
    await prisma.shop.updateMany({ where: { slug, description: '' }, data: { description } });
    await prisma.shop.updateMany({ where: { slug, openingTime: null }, data: { openingTime: DEFAULT_OPENING_TIME } });
    await prisma.shop.updateMany({ where: { slug, closingTime: null }, data: { closingTime: DEFAULT_CLOSING_TIME } });
  }
  return Object.keys(shopDescriptions).length;
}
