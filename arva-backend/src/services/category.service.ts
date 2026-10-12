import { categoryRepository } from '../repositories/category.repository.js';

export interface CategoryResponse {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
}

async function listCategories(): Promise<CategoryResponse[]> {
  const categories = await categoryRepository.findAll();
  return categories.map((category) => ({
    id: String(category.id),
    slug: category.slug,
    name: category.name,
    iconKey: category.iconKey,
  }));
}

export const categoryService = { listCategories };
