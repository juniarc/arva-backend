import { describe, expect, it } from 'vitest';
import type { CartItemRecord } from '../../src/repositories/cart.repository.js';
import { toCartResponse } from '../../src/services/cart.mapper.js';

interface RecordOptions {
  id: number;
  shop: string;
  product: string;
  position?: number;
  price?: number;
  quantity?: number;
  isActive?: boolean;
  productId?: number;
}

function record(options: RecordOptions): CartItemRecord {
  return {
    id: options.id,
    quantity: options.quantity ?? 1,
    variant: {
      id: options.id * 10,
      label: `v${options.position ?? 0}`,
      unit: 'kg',
      price: options.price ?? 1000,
      stock: 10,
      position: options.position ?? 0,
      product: {
        id: options.productId ?? options.id,
        slug: options.product.toLowerCase(),
        name: options.product,
        imageUrl: '/images/dummy/x.jpg',
        isActive: options.isActive ?? true,
        shop: { slug: options.shop.toLowerCase().replace(' ', '-'), name: options.shop },
      },
    },
  };
}

describe('toCartResponse', () => {
  it('returns product.shop and keeps shopName equal to shop.name', () => {
    const cart = toCartResponse([record({ id: 1, shop: 'Shop B', product: 'Mango' })]);

    expect(cart.items[0]?.product.shop).toEqual({ slug: 'shop-b', name: 'Shop B' });
    expect(cart.items[0]?.product.shopName).toBe(cart.items[0]?.product.shop.name);
  });

  it('orders items by shop name, product name, then variant position', () => {
    const cart = toCartResponse([
      record({ id: 1, shop: 'Shop B', product: 'Apple' }),
      record({ id: 2, shop: 'Shop A', product: 'Zucchini' }),
      record({ id: 3, shop: 'Shop A', product: 'Banana', productId: 30, position: 1 }),
      record({ id: 4, shop: 'Shop A', product: 'Banana', productId: 30, position: 0 }),
    ]);

    expect(cart.items.map((item) => item.id)).toEqual(['4', '3', '2', '1']);
  });

  it('leaves out inactive products from items, itemCount and subtotal', () => {
    const cart = toCartResponse([
      record({ id: 1, shop: 'Shop A', product: 'Banana', price: 1000, quantity: 2 }),
      record({ id: 2, shop: 'Shop A', product: 'Hidden', price: 500, quantity: 3, isActive: false }),
    ]);

    expect(cart.items.map((item) => item.id)).toEqual(['1']);
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotal).toBe(2000);
  });

  it('returns an empty cart for no records', () => {
    expect(toCartResponse([])).toEqual({ items: [], itemCount: 0, subtotal: 0 });
  });
});
