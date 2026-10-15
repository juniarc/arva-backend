import type { Request, Response } from 'express';
import { categoryService } from '../services/category.service.js';

async function list(_req: Request, res: Response): Promise<void> {
  const categories = await categoryService.listCategories();
  res.status(200).json({ categories });
}

export const categoryController = { list };
