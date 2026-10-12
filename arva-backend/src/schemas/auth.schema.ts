import { z } from 'zod';

const MAX_PASSWORD_BYTES = 72; // bcrypt ignores everything after 72 bytes

const username = z
  .string({ error: 'Username is required.' })
  .trim()
  .min(1, 'Username is required.')
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username must be at most 30 characters.')
  .regex(/^[A-Za-z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.');

const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .max(254, 'Email must be at most 254 characters.')
  .pipe(z.email('Enter a valid email address.'));

const newPassword = z
  .string({ error: 'Password is required.' })
  .min(1, 'Password is required.')
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES, {
    message: 'Password is too long.',
  })
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

export const registerSchema = z.object({ username, email, password: newPassword });

// Login only checks that the fields are present. Format rules would leak policy and
// block people whose old passwords do not match the current rules.
export const loginSchema = z.object({
  username: z.string({ error: 'Username is required.' }).trim().min(1, 'Username is required.'),
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
