import 'dotenv/config';
import { z } from 'zod';

const EXAMPLE_JWT_SECRET = 'change-me-to-a-long-random-string';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    // Examples: "15m", "1d", "7d". A plain number would mean milliseconds, so it is not allowed.
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN must look like 15m, 12h or 1d')
      .default('1d'),
    // Optional. Where images are hosted, for example http://localhost:3000. When set, image paths
    // such as /images/dummy/x.jpg are returned as full URLs. An empty value counts as not set.
    IMAGE_BASE_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
    CORS_ORIGIN: z.url('CORS_ORIGIN must be a full URL, for example http://localhost:3000'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET === EXAMPLE_JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET is still the example value. Set a real secret in production.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Print variable names and messages only, never the values (they may be secrets).
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
}

export const env = loadEnv();
