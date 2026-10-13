import type { Request, Response } from 'express';
import { shippingChannelService } from '../services/shipping-channel.service.js';

async function list(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await shippingChannelService.listChannels());
}

export const shippingChannelController = { list };
