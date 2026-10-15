import type { Category } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type CategoryRecord = Category;

function findAll(): Promise<CategoryRecord[]> {
  return prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
}

function findBySlug(slug: string): Promise<CategoryRecord | null> {
  return prisma.category.findUnique({ where: { slug } });
}

export const categoryRepository = { findAll, findBySlug };
