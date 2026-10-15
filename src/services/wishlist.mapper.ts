import type { WishlistItemRecord } from '../repositories/wishlist.repository.js';
import { toProductResponse, type ProductResponse } from './product.service.js';

export interface WishlistProduct {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  // One decimal number, as in the product list (the product detail uses an object).
  rating: number;
  soldCount: number;
  city: string;
  imageUrl: string;
  shop: { slug: string; name: string };
  isAvailable: boolean;
}

export interface WishlistItemResponse {
  id: string;
  addedAt: string;
  product: WishlistProduct;
}

export interface WishlistResponse {
  items: WishlistItemResponse[];
  itemCount: number;
}

// The price, discount and rating come from the product list's own mapping.
// Prices are read now. Nothing is copied into the wishlist row.
export function toWishlistProduct(product: WishlistItemRecord['product']): WishlistProduct {
  const { shopSlug, shopName, ...fields }: ProductResponse = toProductResponse(product);
  return {
    ...fields,
    shop: { slug: shopSlug, name: shopName },
    isAvailable: product.variants.some((variant) => variant.stock > 0),
  };
}

// Newest first. The id breaks ties between items added at the same moment.
export function toWishlistResponse(records: WishlistItemRecord[]): WishlistResponse {
  const items = [...records]
    .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime() || b.id - a.id)
    .map(
      (record): WishlistItemResponse => ({
        id: String(record.id),
        addedAt: record.addedAt.toISOString(),
        product: toWishlistProduct(record.product),
      }),
    );

  return { items, itemCount: items.length };
}
