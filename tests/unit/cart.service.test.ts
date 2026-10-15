import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, StockConflictError, ValidationError } from '../../src/lib/errors.js';
import type { CartItemRecord, CartTransaction } from '../../src/repositories/cart.repository.js';

// In-memory cart and variant table. runInTransaction just runs the work with the same fake.
const { state, fakeRepository } = vi.hoisted(() => {
  const state = {
    variants: new Map<number, { id: number; stock: number; price: number; active: boolean }>(),
    cart: new Map<string, { id: number; quantity: number }>(), // key: "userId:variantId"
    nextId: 1,
    deleteCalls: [] as number[][],
  };

  const findByUser = async (userId: number) => {
    const records: unknown[] = [];
    for (const [key, entry] of state.cart) {
      const [cartUserId, variantId] = key.split(':').map(Number);
      const variant = state.variants.get(variantId ?? 0);
      if (cartUserId !== userId || !variant) continue;
      records.push({
        id: entry.id,
        quantity: entry.quantity,
        variant: {
          id: variant.id,
          label: '1 kg',
          unit: 'kg',
          price: variant.price,
          stock: variant.stock,
          position: 0,
          product: {
            id: 1,
            slug: 'banana',
            name: 'Banana',
            imageUrl: '/images/dummy/banana.jpg',
            isActive: variant.active,
            shop: { slug: 'shop', name: 'Shop' },
          },
        },
      });
    }
    return records as CartItemRecord[];
  };

  const transaction = {
    lockActiveVariant: async (variantId: number) => {
      const variant = state.variants.get(variantId);
      return variant?.active ? { id: variant.id, stock: variant.stock } : null;
    },
    findQuantity: async (userId: number, variantId: number) =>
      state.cart.get(`${userId}:${variantId}`)?.quantity ?? 0,
    saveQuantity: async (userId: number, variantId: number, quantity: number) => {
      const existing = state.cart.get(`${userId}:${variantId}`);
      state.cart.set(`${userId}:${variantId}`, { id: existing?.id ?? state.nextId++, quantity });
    },
    findItemVariantId: async (userId: number, itemId: number) => {
      for (const [key, entry] of state.cart) {
        const [cartUserId, variantId] = key.split(':').map(Number);
        if (cartUserId === userId && entry.id === itemId) return variantId ?? null;
      }
      return null;
    },
    updateItemQuantity: async (userId: number, itemId: number, quantity: number) => {
      for (const [key, entry] of state.cart) {
        if (key.startsWith(`${userId}:`) && entry.id === itemId) {
          entry.quantity = quantity;
          return true;
        }
      }
      return false;
    },
    deleteItems: async (userId: number, itemIds: number[]) => {
      state.deleteCalls.push(itemIds);
      let removed = 0;
      for (const [key, entry] of [...state.cart]) {
        if (key.startsWith(`${userId}:`) && itemIds.includes(entry.id)) {
          state.cart.delete(key);
          removed += 1;
        }
      }
      return removed;
    },
    findByUser,
  };

  const fakeRepository = {
    runInTransaction: async <T>(work: (tx: CartTransaction) => Promise<T>) => work(transaction),
    findByUser,
  };

  return { state, fakeRepository };
});

vi.mock('../../src/repositories/cart.repository.js', () => ({ cartRepository: fakeRepository }));

const { cartService } = await import('../../src/services/cart.service.js');

const USER = 1;

beforeEach(() => {
  state.variants.clear();
  state.cart.clear();
  state.nextId = 1;
  state.deleteCalls = [];
  state.variants.set(10, { id: 10, stock: 5, price: 1000, active: true });
  state.variants.set(11, { id: 11, stock: 200, price: 2500, active: true });
  state.variants.set(12, { id: 12, stock: 0, price: 500, active: true });
  state.variants.set(13, { id: 13, stock: 5, price: 500, active: false });
});

async function expectRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the promise to reject.');
    },
    (error: unknown) => error,
  );
}

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

    const error = await expectRejection(cartService.addToCart(USER, { variantId: '10', quantity: 3 }));

    expect(error).toBeInstanceOf(StockConflictError);
    expect((error as StockConflictError).code).toBe('INSUFFICIENT_STOCK');
    expect((error as StockConflictError).message).toBe('Only 2 left in stock.');
    // The cart is unchanged.
    expect(state.cart.get(`${USER}:10`)?.quantity).toBe(3);
  });

  it('says "Only 0 left" when the whole stock is already in the cart', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 5 });

    const error = await expectRejection(cartService.addToCart(USER, { variantId: '10', quantity: 1 }));

    expect((error as StockConflictError).message).toBe('Only 0 left in stock.');
  });

  it('rejects a zero-stock variant with OUT_OF_STOCK', async () => {
    const error = await expectRejection(cartService.addToCart(USER, { variantId: '12', quantity: 1 }));

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

    const error = await expectRejection(cartService.addToCart(USER, { variantId: '11', quantity: 50 }));

    expect(error).toBeInstanceOf(ValidationError);
    expect(state.cart.get(`${USER}:11`)?.quantity).toBe(60);
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

  it("only returns the given user's items", async () => {
    await cartService.addToCart(1, { variantId: '10', quantity: 1 });
    await cartService.addToCart(2, { variantId: '11', quantity: 1 });

    expect((await cartService.getCart(1)).items[0]?.variant.id).toBe('10');
    expect((await cartService.getCart(2)).items[0]?.variant.id).toBe('11');
  });
});

describe('cartService.updateItemQuantity', () => {
  it('updates the quantity and returns the full cart', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 1 });

    const cart = await cartService.updateItemQuantity(USER, '1', { quantity: 4 });

    expect(cart.items[0]?.quantity).toBe(4);
    expect(cart.subtotal).toBe(4 * 1000);
  });

  it('rejects quantity 0 with a message that points to DELETE', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 1 });

    const error = await expectRejection(cartService.updateItemQuantity(USER, '1', { quantity: 0 }));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors.quantity).toContain('DELETE /api/cart/items');
    expect(state.cart.get(`${USER}:10`)?.quantity).toBe(1);
  });

  it('rejects a quantity above the stock, saying how many are left', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 1 });

    const error = await expectRejection(cartService.updateItemQuantity(USER, '1', { quantity: 6 }));

    expect(error).toBeInstanceOf(StockConflictError);
    expect((error as StockConflictError).code).toBe('INSUFFICIENT_STOCK');
    expect((error as StockConflictError).message).toBe('Only 5 left in stock.');
    expect(state.cart.get(`${USER}:10`)?.quantity).toBe(1);
  });

  it('rejects a zero-stock variant with OUT_OF_STOCK', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 1 });
    // The stock sold out after the item was added.
    state.variants.set(10, { id: 10, stock: 0, price: 1000, active: true });

    const error = await expectRejection(cartService.updateItemQuantity(USER, '1', { quantity: 1 }));

    expect((error as StockConflictError).code).toBe('OUT_OF_STOCK');
    expect((error as StockConflictError).message).toBe('This variant is out of stock.');
  });

  it("returns not found for another user's item and leaves it unchanged", async () => {
    await cartService.addToCart(2, { variantId: '10', quantity: 1 });

    const error = await expectRejection(cartService.updateItemQuantity(USER, '1', { quantity: 3 }));

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).message).toBe('Cart item not found.');
    expect(state.cart.get('2:10')?.quantity).toBe(1);
  });

  it('returns not found when the product is inactive', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 1 });
    state.variants.set(10, { id: 10, stock: 5, price: 1000, active: false });

    const error = await expectRejection(cartService.updateItemQuantity(USER, '1', { quantity: 2 }));

    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe('cartService.removeItems', () => {
  it('removes the given items and returns the remaining cart', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 1 });
    await cartService.addToCart(USER, { variantId: '11', quantity: 1 });

    const cart = await cartService.removeItems(USER, ['1']);

    expect(cart.items.map((item) => item.variant.id)).toEqual(['11']);
  });

  it('ignores ids that belong to other users', async () => {
    await cartService.addToCart(2, { variantId: '10', quantity: 1 }); // item 1, other user
    await cartService.addToCart(USER, { variantId: '11', quantity: 1 }); // item 2

    const cart = await cartService.removeItems(USER, ['1', '999']);

    expect(cart.items).toHaveLength(1);
    expect(state.cart.has('2:10')).toBe(true);
  });

  it('removes duplicate ids before processing', async () => {
    await cartService.addToCart(USER, { variantId: '10', quantity: 1 });

    await cartService.removeItems(USER, ['1', '1', '1']);

    expect(state.deleteCalls).toEqual([[1]]);
  });
});
