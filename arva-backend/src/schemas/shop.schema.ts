import { z } from 'zod';

export const shopParamsSchema = z.object({
  slug: z.string().trim().min(1).max(100),
});
