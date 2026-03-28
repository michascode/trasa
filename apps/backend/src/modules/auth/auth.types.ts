import { Role } from '@prisma/client';

export type AuthTokenPayload = {
  sub: string;
  role: Role;
  email: string;
};
