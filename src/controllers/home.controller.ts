import type { Request, Response } from 'express';
import { homeService } from '../services/home.service.js';

async function getHome(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await homeService.getHome());
}

export const homeController = { getHome };
