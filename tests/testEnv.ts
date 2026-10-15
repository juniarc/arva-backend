import 'dotenv/config';

// Test settings shared by both vitest configs. These are not secrets.
// The test database must be a different database from development, and its name
// must end with "_test" (checked in tests/globalSetup.ts).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://arva:arva@localhost:5432/arva_test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '15m';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.IMAGE_BASE_URL = '';
