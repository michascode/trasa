import { UserRole } from '@prisma/client';

export type AuthTokenPayload = {
  sub: string;
  role: UserRole;
  email: string;
};
