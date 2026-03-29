import { PrismaClient } from '@prisma/client';

function makeUnavailableProxy() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('Prisma Client nie jest gotowy. Uruchom `npm run db:generate --workspace @trasa/backend` po naprawie schema.prisma.');
      },
    },
  );
}

export const prisma = (() => {
  try {
    return new PrismaClient();
  } catch (_error) {
    return makeUnavailableProxy() as unknown as PrismaClient;
  }
})();
