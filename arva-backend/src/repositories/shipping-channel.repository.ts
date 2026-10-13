import { prisma } from '../lib/prisma.js';

export interface ShippingChannelRecord {
  id: number;
  name: string;
}

function findAll(): Promise<ShippingChannelRecord[]> {
  return prisma.shippingChannel.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export const shippingChannelRepository = { findAll };
