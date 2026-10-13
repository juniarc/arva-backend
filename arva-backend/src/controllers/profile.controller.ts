import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseBody } from '../middleware/validate.js';
import { updateProfileSchema, upsertAddressSchema } from '../schemas/profile.schema.js';
import { profileService } from '../services/profile.service.js';

// requireAuth sets req.user. The user id always comes from the verified token.
function getUserId(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError('Please log in.');
  }
  return req.user.id;
}

async function getProfile(req: Request, res: Response): Promise<void> {
  res.status(200).json(await profileService.getProfile(getUserId(req)));
}

async function updateProfile(req: Request, res: Response): Promise<void> {
  const input = parseBody(updateProfileSchema, req);
  res.status(200).json(await profileService.updateProfile(getUserId(req), input));
}

async function upsertAddress(req: Request, res: Response): Promise<void> {
  const input = parseBody(upsertAddressSchema, req);
  res.status(200).json(await profileService.upsertAddress(getUserId(req), input));
}

export const profileController = { getProfile, updateProfile, upsertAddress };
