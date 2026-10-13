import { shippingChannelRepository } from '../repositories/shipping-channel.repository.js';

export interface ShippingChannelListResponse {
  items: { id: string; name: string }[];
}

async function listChannels(): Promise<ShippingChannelListResponse> {
  const channels = await shippingChannelRepository.findAll();
  return { items: channels.map((channel) => ({ id: String(channel.id), name: channel.name })) };
}

export const shippingChannelService = { listChannels };
