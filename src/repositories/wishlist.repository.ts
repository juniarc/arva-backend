import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// The product fields are the product list's, plus variant stock for isAvailable.
// userId is never selected, so it cannot reach the API.
const wishlistItemSelect = {
  id: true,
  addedAt: true,
  product: {
    select: {
      id: true,
      slug: true,
      name: true,
      imageUrl: true,
      ratingTenths: true,
      soldCount: true,
      category: { select: { slug: true, name: true } },
      shop: { select: { slug: true, name: true, city: true } },
      // Cheapest first, so variants[0] is the "from" variant.
      variants: {
        select: { price: true, originalPrice: true, stock: true },
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
      },
    },
  },
} satisfies Prisma.WishlistItemSelect;

export type WishlistItemRecord = Prisma.WishlistItemGetPayload<{ select: typeof wishlistItemSelect }>;

type Client = Prisma.TransactionClient | typeof prisma;

// Only this user's rows, and only products the public can see (active, with a variant).
// Rows of inactive products stay in the database.
// The service sorts the result (see wishlist.mapper.ts), so id order only keeps the read stable.
function readWishlist(client: Client, userId: number): Promise<WishlistItemRecord[]> {
  return client.wishlistItem.findMany({
    where: { userId, product: { isActive: true, variants: { some: {} } } },
    orderBy: { id: 'asc' },
    select: wishlistItemSelect,
  });
}

function findByUser(userId: number): Promise<WishlistItemRecord[]> {
  return readWishlist(prisma, userId);
}

async function activeProductExists(productId: number): Promise<boolean> {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true, variants: { some: {} } },
    select: { id: true },
  });
  return product !== null;
}

// Inserts the row. A unique violation (P2002) means the product is already in the
// wishlist, which is fine. That also covers two parallel adds: one inserts, the other
// hits the unique constraint. This must not run inside a transaction, because a failed
// statement would abort it. Returns true when a new row was created.
async function addIfAbsent(userId: number, productId: number): Promise<boolean> {
  try {
    await prisma.wishlistItem.create({ data: { userId, productId }, select: { id: true } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

// One DELETE scoped to the user, then the read, in one transaction.
function removeAndFind(userId: number, itemIds: number[]): Promise<WishlistItemRecord[]> {
  return prisma.$transaction(async (client) => {
    await client.wishlistItem.deleteMany({ where: { userId, id: { in: itemIds } } });
    return readWishlist(client, userId);
  });
}

export const wishlistRepository = { findByUser, activeProductExists, addIfAbsent, removeAndFind };
