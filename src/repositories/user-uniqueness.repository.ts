import type { Prisma } from '@prisma/client';
import type { prisma } from '../lib/prisma.js';

type Client = Prisma.TransactionClient | typeof prisma;

// Usernames are unique case-insensitively through the usernameLower column (the same
// unique index register relies on). Emails are stored lowercase, so they compare directly.
// "Other" means every user except the one asking, so keeping your own value is not a conflict.

export async function isUsernameTakenByOther(
  client: Client,
  usernameLower: string,
  userId: number,
): Promise<boolean> {
  const other = await client.user.findFirst({
    where: { usernameLower, id: { not: userId } },
    select: { id: true },
  });
  return other !== null;
}

export async function isEmailTakenByOther(client: Client, email: string, userId: number): Promise<boolean> {
  const other = await client.user.findFirst({
    where: { email, id: { not: userId } },
    select: { id: true },
  });
  return other !== null;
}
