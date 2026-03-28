import { Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { loginUser, registerUser } from './auth.service.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const user = await registerUser(parsed.data.email, parsed.data.password, parsed.data.role);
  return res.status(201).json(user);
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const result = await loginUser(parsed.data.email, parsed.data.password);
  if (!result) return res.status(401).json({ message: 'Invalid credentials' });

  return res.json(result);
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

export { router as authRouter };
