import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// userId and isVisible are deliberately not selected.
const reviewSelect = {
  id: true,
  authorName: true,
  authorAvatarUrl: true,
  rating: true,
  text: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;

export type ReviewRecord = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

function findVisibleByProduct(productId: number, skip: number, take: number): Promise<ReviewRecord[]> {
  return prisma.review.findMany({
    where: { productId, isVisible: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip,
    take,
    select: reviewSelect,
  });
}

function countVisibleByProduct(productId: number): Promise<number> {
  return prisma.review.count({ where: { productId, isVisible: true } });
}

export const reviewRepository = { findVisibleByProduct, countVisibleByProduct };
