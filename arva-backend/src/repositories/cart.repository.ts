import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const cartItemSelect = {
  id: true,
  quantity: true,
  variant: {
    select: {
      id: true,
      label: true,
      unit: true,
      price: true,
      stock: true,
      position: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          imageUrl: true,
          isActive: true,
          shop: { select: { slug: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.CartItemSelect;

export type CartItemRecord = Prisma.CartItemGetPayload<{ select: typeof cartItemSelect }>;

export interface LockedVariant {
  id: number;
  stock: number;
}

// The steps the service takes inside one database transaction.
export interface CartTransaction {
  lockActiveVariant(variantId: number): Promise<LockedVariant | null>;
  findQuantity(userId: number, variantId: number): Promise<number>;
  saveQuantity(userId: number, variantId: number, quantity: number): Promise<void>;
  // The variant id of one of THIS user's cart items, or null.
  findItemVariantId(userId: number, itemId: number): Promise<number | null>;
  // Returns false when the user has no such item.
  updateItemQuantity(userId: number, itemId: number, quantity: number): Promise<boolean>;
  // One DELETE statement. Only this user's rows match. Returns how many were removed.
  deleteItems(userId: number, itemIds: number[]): Promise<number>;
  findByUser(userId: number): Promise<CartItemRecord[]>;
}

type Client = Prisma.TransactionClient | typeof prisma;

// The service sorts and filters these rows (see cart.mapper.ts). Id order keeps the read stable.
function readCart(client: Client, userId: number): Promise<CartItemRecord[]> {
  return client.cartItem.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: cartItemSelect,
  });
}

function findByUser(userId: number): Promise<CartItemRecord[]> {
  return readCart(prisma, userId);
}

function createTransaction(client: Prisma.TransactionClient): CartTransaction {
  return {
    // A no-op UPDATE takes a row lock on the variant until the transaction ends.
    // Two concurrent writes for the same variant therefore run one after the other,
    // so the second one sees the first one's change when it checks the stock.
    // It also matches nothing for an unknown variant or an inactive product.
    async lockActiveVariant(variantId) {
      const locked = await client.productVariant.updateMany({
        where: { id: variantId, product: { isActive: true } },
        data: { stock: { increment: 0 } },
      });
      if (locked.count === 0) {
        return null;
      }
      return client.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, stock: true },
      });
    },

    async findQuantity(userId, variantId) {
      const item = await client.cartItem.findUnique({
        where: { userId_variantId: { userId, variantId } },
        select: { quantity: true },
      });
      return item?.quantity ?? 0;
    },

    async saveQuantity(userId, variantId, quantity) {
      await client.cartItem.upsert({
        where: { userId_variantId: { userId, variantId } },
        create: { userId, variantId, quantity },
        update: { quantity },
      });
    },

    async findItemVariantId(userId, itemId) {
      const item = await client.cartItem.findFirst({
        where: { id: itemId, userId },
        select: { variantId: true },
      });
      return item?.variantId ?? null;
    },

    async updateItemQuantity(userId, itemId, quantity) {
      const updated = await client.cartItem.updateMany({
        where: { id: itemId, userId },
        data: { quantity },
      });
      return updated.count > 0;
    },

    async deleteItems(userId, itemIds) {
      const removed = await client.cartItem.deleteMany({
        where: { userId, id: { in: itemIds } },
      });
      return removed.count;
    },

    findByUser: (userId) => readCart(client, userId),
  };
}

function runInTransaction<T>(work: (tx: CartTransaction) => Promise<T>): Promise<T> {
  return prisma.$transaction((client) => work(createTransaction(client)));
}

export const cartRepository = { findByUser, runInTransaction };
