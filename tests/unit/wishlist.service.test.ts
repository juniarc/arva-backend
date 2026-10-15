import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/errors.js';
import type { WishlistItemRecord } from '../../src/repositories/wishlist.repository.js';

// In-memory wishlist. Rows are { id, userId, productId, addedAt }.
const { state, fakeRepository } = vi.hoisted(() => {
  interface Row {
    id: number;
    userId: number;
    productId: number;
    addedAt: Date;
  }
  const state = {
    rows: [] as Row[],
    activeProducts: new Set<number>(),
    nextId: 1,
    deleteCalls: [] as number[][],
  };

  const toRecords = (userId: number) =>
    state.rows
      .filter((row) => row.userId === userId && state.activeProducts.has(row.productId))
      .map((row) => ({
        id: row.id,
        addedAt: row.addedAt,
        product: {
          id: row.productId,
          slug: `p${row.productId}`,
          name: `P${row.productId}`,
          imageUrl: '/images/dummy/x.jpg',
          ratingTenths: 34,
          soldCount: 1,
          category: { slug: 'fruits', name: 'Fruits' },
          shop: { slug: 'shop', name: 'Shop', city: 'Jakarta' },
          variants: [{ price: 1000, originalPrice: null, stock: 1 }],
        },
      })) as WishlistItemRecord[];

  const fakeRepository = {
    findByUser: async (userId: number) => toRecords(userId),
    activeProductExists: async (productId: number) => state.activeProducts.has(productId),
    addIfAbsent: async (userId: number, productId: number) => {
      if (state.rows.some((row) => row.userId === userId && row.productId === productId)) {
        return false;
      }
      state.rows.push({ id: state.nextId++, userId, productId, addedAt: new Date(2026, 0, state.nextId) });
      return true;
    },
    removeAndFind: async (userId: number, itemIds: number[]) => {
      state.deleteCalls.push(itemIds);
      state.rows = state.rows.filter((row) => !(row.userId === userId && itemIds.includes(row.id)));
      return toRecords(userId);
    },
  };

  return { state, fakeRepository };
});

vi.mock('../../src/repositories/wishlist.repository.js', () => ({ wishlistRepository: fakeRepository }));

const { wishlistService } = await import('../../src/services/wishlist.service.js');

const USER = 1;

beforeEach(() => {
  state.rows = [];
  state.nextId = 1;
  state.deleteCalls = [];
  state.activeProducts = new Set([10, 11, 12]);
});

describe('wishlistService.addItem', () => {
  it('adds a product and returns the list, newest first', async () => {
    await wishlistService.addItem(USER, { productId: '10' });
    const list = await wishlistService.addItem(USER, { productId: '11' });

    expect(list.items.map((item) => item.product.id)).toEqual(['11', '10']);
    expect(list.itemCount).toBe(2);
  });

  it('returns the same list and creates no duplicate when the product is already there', async () => {
    const first = await wishlistService.addItem(USER, { productId: '10' });
    const second = await wishlistService.addItem(USER, { productId: '10' });

    expect(second).toEqual(first);
    expect(state.rows).toHaveLength(1);
  });

  it('throws not found for an unknown or inactive product', async () => {
    await expect(wishlistService.addItem(USER, { productId: '999' })).rejects.toBeInstanceOf(NotFoundError);
    expect(state.rows).toHaveLength(0);
  });
});

describe('wishlistService.getWishlist', () => {
  it('returns an empty list', async () => {
    expect(await wishlistService.getWishlist(USER)).toEqual({ items: [], itemCount: 0 });
  });

  it("only returns the given user's items", async () => {
    await wishlistService.addItem(1, { productId: '10' });
    await wishlistService.addItem(2, { productId: '11' });

    expect((await wishlistService.getWishlist(1)).items.map((i) => i.product.id)).toEqual(['10']);
  });
});

describe('wishlistService.removeItems', () => {
  it('removes the given items and returns the rest', async () => {
    await wishlistService.addItem(USER, { productId: '10' }); // item 1
    await wishlistService.addItem(USER, { productId: '11' }); // item 2

    const list = await wishlistService.removeItems(USER, ['1']);

    expect(list.items.map((item) => item.product.id)).toEqual(['11']);
  });

  it('changes nothing for ids that belong to another user', async () => {
    await wishlistService.addItem(2, { productId: '10' }); // item 1, other user
    await wishlistService.addItem(USER, { productId: '11' }); // item 2

    const list = await wishlistService.removeItems(USER, ['1', '999']);

    expect(list.itemCount).toBe(1);
    expect(state.rows.some((row) => row.userId === 2)).toBe(true);
  });

  it('removes duplicate ids once', async () => {
    await wishlistService.addItem(USER, { productId: '10' });

    await wishlistService.removeItems(USER, ['1', '1', '1']);

    expect(state.deleteCalls).toEqual([[1]]);
  });
});
