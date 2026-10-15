import { Prisma, type User } from '@prisma/client';
import { ConflictError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export type UserRecord = User;

export interface NewUser {
  username: string;
  usernameLower: string;
  email: string;
  passwordHash: string;
}

function findById(id: number): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { id } });
}

function findByUsernameLower(usernameLower: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { usernameLower } });
}

function findByEmail(email: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { email } });
}

// The service checks for duplicates first, but two requests can race past that check.
// The database unique indexes are the final guard, so a unique violation (P2002)
// is translated into the same ConflictError the service would have thrown.
async function create(data: NewUser): Promise<UserRecord> {
  try {
    // A new user's display name starts as their username. The profile update changes it.
    return await prisma.user.create({ data: { ...data, name: data.username } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      if (target.includes('email')) {
        throw new ConflictError('Email is already taken.', 'email');
      }
      throw new ConflictError('Username is already taken.', 'username');
    }
    throw error;
  }
}

export const userRepository = { findById, findByUsernameLower, findByEmail, create };
