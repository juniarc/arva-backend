import type { Prisma } from '@prisma/client';
import type { prisma } from '../lib/prisma.js';

export type DbClient = Prisma.TransactionClient | typeof prisma;

// What the draft rules need to know about a cart item: its quantity, the stock of its
// variant, and whether its product is still on sale.
const selectedCartItemSelect = {
  id: true,
  quantity: true,
  variant: {
    select: {
      stock: true,
      product: { select: { name: true, isActive: true } },
    },
  },
} satisfies Prisma.CartItemSelect;

export type SelectedCartItem = Prisma.CartItemGetPayload<{ select: typeof selectedCartItemSelect }>;

// Only this user's cart items match, so ids of other users look the same as missing ones.
export function findSelectedCartItems(
  client: DbClient,
  userId: number,
  cartItemIds: number[],
): Promise<SelectedCartItem[]> {
  return client.cartItem.findMany({
    where: { userId, id: { in: cartItemIds } },
    orderBy: { id: 'asc' },
    select: selectedCartItemSelect,
  });
}
