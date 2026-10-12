import type { Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { parseBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';

async function register(req: Request, res: Response): Promise<void> {
  const input = parseBody(registerSchema, req);
  const user = await authService.register(input);
  res.status(201).json(user);
}

async function login(req: Request, res: Response): Promise<void> {
  const input = parseBody(loginSchema, req);
  const result = await authService.login(input);
  res.status(200).json(result);
}

async function me(req: Request, res: Response): Promise<void> {
  // requireAuth sets req.user. This check only narrows the type.
  if (!req.user) {
    throw new UnauthorizedError('Please log in.');
  }
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ user });
}

export const authController = { register, login, me };
