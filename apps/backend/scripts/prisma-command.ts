import { spawnSync } from 'node:child_process';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/trasa?schema=public';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: tsx scripts/prisma-command.ts <prisma args...>');
  process.exit(1);
}

const mergedEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
};

if (!process.env.DATABASE_URL) {
  console.warn(`[prisma-command] DATABASE_URL was not set. Using fallback: ${DEFAULT_DATABASE_URL}`);
  console.warn('[prisma-command] For production/local custom DB, set DATABASE_URL in apps/backend/.env first.');
}

const result = spawnSync('npx', ['prisma', ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: mergedEnv,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
