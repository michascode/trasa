const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/trasa?schema=public';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  console.warn(`[seed] DATABASE_URL was not set. Using fallback: ${DEFAULT_DATABASE_URL}`);
}

await import('../prisma/seed.ts');
