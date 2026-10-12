import { execSync } from 'node:child_process';

// Runs once before all tests: makes sure we point at a test database, then applies migrations to it.
export default function setup(): void {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const databaseName = new URL(databaseUrl).pathname.replace('/', '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests: database "${databaseName}" does not end with "_test". ` +
        'Tests delete all users, so they must never run against a real database.',
    );
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
