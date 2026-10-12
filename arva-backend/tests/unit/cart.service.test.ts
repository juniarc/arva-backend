import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, StockConflictError, ValidationError } from '../../src/lib/errors.js';
import type { CartItemRecord, CartTransaction } from '../../src/repositories/cart.repository.js';

// In-memory cart and variant table. runInTransaction just runs the work with the same fake.
const { state, fakeRepository } = vi.hoisted(() => {
  const state = {
    variants: new Map<number, { id: number; stock: number; price: number; active: boolean }>(),
    cart: new Map<string, number>(), // key: "userId:variantId"
  };

  const transaction = {
    lockActiveVariant: async (variantId: number) => {
      const variant = state.variants.get(variantId);
      return variant?.active ? { id: variant.id, stock: variant.stock } : null;
    },
    findQuantity: async (userId: number, variantId: number) =>
      state.cart.get(`${userId}:${variantId}`) ?? 0,
    saveQuantity: async (userId: number, variantId: number, quantity: number) => {
      state.cart.set(`${userId}:${variantId}`, quantity);
    },
  };

  const fakeRepository = {
    runInTransaction: async <T>(work: (tx: CartTransaction) => Promise<T>) => work(transaction),
    findByUser: async (userId: number) => {
      const records: unknown[] = [];
      for (const [key, quantity] of state.cart) {
        const [cartUserId, variantId] = key.split(':').map(Number);
        const variant = state.variants.get(variantId ?? 0);
        if (cartUserId !== userId || !variant) continue;
        records.push({
          id: records.length + 1,
          userId,
          variantId: variant.id,
          quantity,
          variant: {
            id: variant.id,
            label: '1 kg',
            unit: 'kg',
            price: variant.price,
            stock: variant.stock,
            product: {
              id: 1,
              slug: 'banana',
              name: 'Banana',
              imageUrl: '/images/dummy/banana.jpg',
              shop: { name: 'Shop' },
            },
          },
        });
      }
      return records as CartItemRecord[];
    },
  };

  return { state, fakeRepository };
});

vi.mock('../../src/repositories/cart.repository.js', () => ({ cartRepository: fakeRepository }));

const { cartService } = await import('../../src/services/cart.service.js');

const USER = 1;

beforeEach(() => {
  state.variants.clear();
  state.cart.clear();
  state.variants.set(10, { id: 10, stock: 5, price: 1000, active: true });
  state.variants.set(11, { id: 11, stock: 200, price: 2500, active: true });
  state.variants.set(12, { id: 12, stock: 0, price: 500, active: true });
  state.variants.set(13, { id: 13, stock: 5, price: 500, active: false });
});

describe('cartService.addToCart', () => {
  it('adds a new variant and returns the cart', async () => {
    const cart = await cartService.addToCart(USER, { variantId: '10', quantity: 2 });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ quantity: 2, variant: { id: '10', price: 1000 } });
  });

  it('increases the quantity when the variant is already in the cart', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 2 });
    const cart = await cartService.addToCart(USER, { variantId: '10', quantity: 3 });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(5);
  });

  it('rejects when the new total exceeds stock, saying how many are left', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 3 });

    const error = await cartService
      .addToCart(USER, { variantId: '10', quantity: 3 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StockConflictError);
    expect((error as StockConflictError).code).toBe('INSUFFICIENT_STOCK');
    expect((error as StockConflictError).message).toBe('Only 2 left in stock.');
    // The cart is unchanged.
    expect(state.cart.get(`${USER}:10`)).toBe(3);
  });

  it('says "Only 0 left" when the whole stock is already in the cart', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 5 });

    const error = await cartService
      .addToCart(USER, { variantId: '10', quantity: 1 })
      .catch((e: unknown) => e);

    expect((error as StockConflictError).message).toBe('Only 0 left in stock.');
  });

  it('rejects a zero-stock variant with OUT_OF_STOCK', async () => {
    const error = await cartService
      .addToCart(USER, { variantId: '12', quantity: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StockConflictError);
    expect((error as StockConflictError).code).toBe('OUT_OF_STOCK');
    expect((error as StockConflictError).message).toBe('This variant is out of stock.');
  });

  it('rejects an unknown variant and a variant of an inactive product', async () => {
    await expect(cartService.addToCart(USER, { variantId: '999', quantity: 1 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(cartService.addToCart(USER, { variantId: '13', quantity: 1 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('rejects a total above 99 even when stock allows it', async () => {
    await cartService.addToCart(USER, { variantId: '11', quantity: 60 });

    const error = await cartService
      .addToCart(USER, { variantId: '11', quantity: 50 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(state.cart.get(`${USER}:11`)).toBe(60);
  });
});

describe('cartService.getCart', () => {
  it('sums price times quantity for the subtotal and quantities for itemCount', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 2 }); // 2 x 1000
    await cartService.addToCart(USER, { variantId: '11', quantity: 3 }); // 3 x 2500

    const cart = await cartService.getCart(USER);

    expect(cart.itemCount).toBe(5);
    expect(cart.subtotal).toBe(2 * 1000 + 3 * 2500);
  });

  it('returns an empty cart', async () => {
    expect(await cartService.getCart(USER)).toEqual({ items: [], itemCount: 0, subtotal: 0 });
  });

  it('only returns the given user\'s items', async () => {
    await cartService.addToCart(1, { variantId: '10', quantity: 1 });
    await cartService.addToCart(2, { variantId: '11', quantity: 1 });

    expect((await cartService.getCart(1)).items[0]?.variant.id).toBe('10');
    expect((await cartService.getCart(2)).items[0]?.variant.id).toBe('11');
  });
});
