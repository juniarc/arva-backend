import { defineConfig } from 'vitest/config';
import './tests/testEnv.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Integration tests share one database, so test files run one at a time.
    fileParallelism: false,
    // bcrypt with cost 12 is deliberately slow.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
