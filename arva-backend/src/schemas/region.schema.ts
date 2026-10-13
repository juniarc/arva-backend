import { z } from 'zod';

// A numeric string such as "12". Up to 9 digits keeps it inside a database integer.
export const regionIdParamsSchema = z.object({
  id: z.string().regex(/^\d{1,9}$/, 'Id must be a numeric string.'),
});
