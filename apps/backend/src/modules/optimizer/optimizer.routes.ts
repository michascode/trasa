import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { runOptimizationStub } from './optimizer.service.js';

const router = Router();

const optimizationInput = z.object({
  vehicles: z.number().int().positive(),
  stops: z.number().int().positive(),
});

router.post('/run', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req, res) => {
  const parsed = optimizationInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const result = await runOptimizationStub(parsed.data);
  return res.status(501).json(result);
});

export { router as optimizerRouter };
