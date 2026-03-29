import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { AuthTokenPayload } from './auth.types.js';

type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER';

export async function registerUser(email: string, password: string, role: UserRole = 'VIEWER') {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email, passwordHash, role },
    select: { id: true, email: true, role: true, createdAt: true },
  });
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  const payload: AuthTokenPayload = { sub: user.id, role: user.role, email: user.email };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });

  return {
    token,
    user: { id: user.id, email: user.email, role: user.role },
  };
}
