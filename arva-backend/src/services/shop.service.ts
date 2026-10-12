import { NotFoundError } from '../lib/errors.js';
import { toImageUrl } from '../lib/imageUrl.js';
import { toShopRating, type ShopRatingResponse } from '../lib/rating.js';
import { shopRepository } from '../repositories/shop.repository.js';

export interface ShopProfileResponse {
  slug: string;
  name: string;
  city: string;
  logoUrl: string | null;
  rating: ShopRatingResponse;
  productCount: number;
}

async function getShopProfile(slug: string): Promise<ShopProfileResponse> {
  const shop = await shopRepository.findBySlug(slug);
  if (!shop) {
    throw new NotFoundError('Shop not found.');
  }

  return {
    slug: shop.slug,
    name: shop.name,
    city: shop.city,
    logoUrl: shop.logoUrl === null ? null : toImageUrl(shop.logoUrl),
    rating: toShopRating(shop.ratingTenths, shop.ratingCount),
    // The repository counts active products only.
    productCount: shop._count.products,
  };
}

export const shopService = { getShopProfile };
