import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const cartItemInclude = {
  variant: { include: { product: { include: { shop: true } } } },
} satisfies Prisma.CartItemInclude;

export type CartItemRecord = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

export interface LockedVariant {
  id: number;
  stock: number;
}

// The steps the service takes inside one database transaction.
export interface CartTransaction {
  lockActiveVariant(variantId: number): Promise<LockedVariant | null>;
  findQuantity(userId: number, variantId: number): Promise<number>;
  saveQuantity(userId: number, variantId: number, quantity: number): Promise<void>;
}

function findByUser(userId: number): Promise<CartItemRecord[]> {
  return prisma.cartItem.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: cartItemInclude,
  });
}

function createTransaction(client: Prisma.TransactionClient): CartTransaction {
  return {
    // A no-op UPDATE takes a row lock on the variant until the transaction ends.
    // Two concurrent adds for the same variant therefore run one after the other,
    // so the second one sees the first one's cart change when it checks the stock.
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
  };
}

function runInTransaction<T>(work: (tx: CartTransaction) => Promise<T>): Promise<T> {
  return prisma.$transaction((client) => work(createTransaction(client)));
}

export const cartRepository = { findByUser, runInTransaction };
