import { defineConfig } from 'vitest/config';
import './tests/testEnv.js';

// Unit tests only. They use fakes, so no database is needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
