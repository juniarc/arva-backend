import type { Banner } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type BannerRecord = Banner;

function findActive(): Promise<BannerRecord[]> {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  });
}

export const bannerRepository = { findActive };
