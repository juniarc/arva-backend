import type { PrismaClient } from '@prisma/client';

export const shippingChannels = [
  { name: 'JNE', sortOrder: 1 },
  { name: 'J&T Express', sortOrder: 2 },
];

// Safe to run many times: every channel is upserted by its unique name.
export async function seedShippingChannels(prisma: PrismaClient): Promise<number> {
  for (const channel of shippingChannels) {
    await prisma.shippingChannel.upsert({
      where: { name: channel.name },
      create: channel,
      update: { sortOrder: channel.sortOrder },
    });
  }
  return shippingChannels.length;
}
