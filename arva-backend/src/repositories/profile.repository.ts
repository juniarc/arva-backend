import { Prisma } from '@prisma/client';
import { UniqueViolationError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { uniqueFieldFromTarget } from '../lib/unique-violation.js';
import { regionRepository, type RegionIds, type RegionParents } from './region.repository.js';
import { isEmailTakenByOther, isUsernameTakenByOther } from './user-uniqueness.repository.js';

// Only these fields ever leave the repository: no user id, password hash or timestamps.
const profileSelect = {
  username: true,
  name: true,
  email: true,
  phone: true,
  photoUrl: true,
  address: {
    select: {
      street: true,
      zipCode: true,
      subDistrict: { select: { id: true, name: true } },
      district: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      province: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type ProfileRecord = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

export interface ProfileUpdateData {
  name: string;
  username: string;
  usernameLower: string;
  email: string;
  phone: string | null;
}

export interface AddressData extends RegionIds {
  street: string;
  zipCode: string;
}

// The steps the service takes inside one database transaction.
export interface ProfileTransaction {
  isUsernameTakenByOther(usernameLower: string, userId: number): Promise<boolean>;
  isEmailTakenByOther(email: string, userId: number): Promise<boolean>;
  // Returns false when the user no longer exists.
  updateProfile(userId: number, data: ProfileUpdateData): Promise<boolean>;
  findRegionParents(ids: RegionIds): Promise<RegionParents>;
  // One row per user: creates it, or replaces the existing one.
  upsertAddress(userId: number, data: AddressData): Promise<void>;
  findProfile(userId: number): Promise<ProfileRecord | null>;
}

function createTransaction(client: Prisma.TransactionClient): ProfileTransaction {
  return {
    isUsernameTakenByOther: (usernameLower, userId) => isUsernameTakenByOther(client, usernameLower, userId),
    isEmailTakenByOther: (email, userId) => isEmailTakenByOther(client, email, userId),

    async updateProfile(userId, data) {
      const updated = await client.user.updateMany({ where: { id: userId }, data });
      return updated.count > 0;
    },

    findRegionParents: (ids) => regionRepository.findParents(ids, client),

    async upsertAddress(userId, data) {
      await client.userAddress.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
        select: { id: true },
      });
    },

    findProfile: (userId) => client.user.findUnique({ where: { id: userId }, select: profileSelect }),
  };
}

// The service checks for duplicates first, but two requests can race past that check.
// The database unique indexes are the final guard. A unique violation (P2002) on the
// username or email index is translated into a UniqueViolationError, and the transaction
// is rolled back.
async function runInTransaction<T>(work: (tx: ProfileTransaction) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction((client) => work(createTransaction(client)));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const field = uniqueFieldFromTarget(error.meta?.target);
      if (field !== null) {
        throw new UniqueViolationError(field);
      }
    }
    throw error;
  }
}

function findProfile(userId: number): Promise<ProfileRecord | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
}

export const profileRepository = { runInTransaction, findProfile };
