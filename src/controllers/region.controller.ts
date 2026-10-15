import type { Request, Response } from 'express';
import { parseParams } from '../middleware/validate.js';
import { regionIdParamsSchema } from '../schemas/region.schema.js';
import { regionService } from '../services/region.service.js';

async function listProvinces(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await regionService.listProvinces());
}

async function listCities(req: Request, res: Response): Promise<void> {
  const { id } = parseParams(regionIdParamsSchema, req);
  res.status(200).json(await regionService.listCities(id));
}

async function listDistricts(req: Request, res: Response): Promise<void> {
  const { id } = parseParams(regionIdParamsSchema, req);
  res.status(200).json(await regionService.listDistricts(id));
}

async function listSubDistricts(req: Request, res: Response): Promise<void> {
  const { id } = parseParams(regionIdParamsSchema, req);
  res.status(200).json(await regionService.listSubDistricts(id));
}

export const regionController = { listProvinces, listCities, listDistricts, listSubDistricts };
