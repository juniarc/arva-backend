import { toImageUrl } from '../lib/imageUrl.js';
import { compareCartLines, type CartLineKey } from '../lib/cart-order.js';
import { calculateLineTotal } from '../lib/money.js';
import type { CartItemRecord } from '../repositories/cart.repository.js';

export interface CartItemResponse {
  id: string;
  quantity: number;
  product: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string;
    // Kept for compatibility. Always equal to shop.name.
    shopName: string;
    shop: { slug: string; name: string };
  };
  variant: { id: string; label: string; unit: string; price: number; stock: number };
}

export interface CartResponse {
  items: CartItemResponse[];
  itemCount: number;
  subtotal: number;
}

// Order: see compareCartLines.
function compareRecords(a: CartItemRecord, b: CartItemRecord): number {
  return compareCartLines(toLineKey(a), toLineKey(b));
}

function toLineKey(record: CartItemRecord): CartLineKey {
  const product = record.variant.product;
  return {
    id: record.id,
    shopName: product.shop.name,
    productName: product.name,
    productId: product.id,
    variantPosition: record.variant.position,
  };
}

// The cart shows the variant's CURRENT price. No price is copied into the cart row.
// Items of inactive products are left out of the items and the totals. Their rows stay
// in the database, so the items come back if the product is activated again.
export function toCartResponse(records: CartItemRecord[]): CartResponse {
  const items = records
    .filter((record) => record.variant.product.isActive)
    .sort(compareRecords)
    .map(
      (record): CartItemResponse => ({
        id: String(record.id),
        quantity: record.quantity,
        product: {
          id: String(record.variant.product.id),
          slug: record.variant.product.slug,
          name: record.variant.product.name,
          imageUrl: toImageUrl(record.variant.product.imageUrl),
          shopName: record.variant.product.shop.name,
          shop: {
            slug: record.variant.product.shop.slug,
            name: record.variant.product.shop.name,
          },
        },
        variant: {
          id: String(record.variant.id),
          label: record.variant.label,
          unit: record.variant.unit,
          price: record.variant.price,
          stock: record.variant.stock,
        },
      }),
    );

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce(
      (sum, item) => sum + calculateLineTotal(item.variant.price, item.quantity),
      0,
    ),
  };
}
