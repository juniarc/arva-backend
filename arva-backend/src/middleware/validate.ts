import type { Request } from 'express';
import type { z } from 'zod';
import { ValidationError, type FieldErrors } from '../lib/errors.js';

// Validates data with a zod schema and returns typed data.
// On failure it throws a ValidationError with one message per field.
function parseWith<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      // .strict() schemas report unknown keys. Blame each key by name.
      for (const key of issue.keys) {
        errors[key] ??= 'Unknown field.';
      }
      continue;
    }
    const field = String(issue.path[0] ?? 'body');
    // Keep the first message for each field.
    errors[field] ??= issue.message;
  }
  throw new ValidationError('Please fix the highlighted fields.', errors);
}

export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  return parseWith(schema, req.body ?? {});
}

export function parseQuery<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  return parseWith(schema, req.query);
}

export function parseParams<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  return parseWith(schema, req.params);
}
