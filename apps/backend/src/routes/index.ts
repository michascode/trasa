import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { optimizerRouter } from '../modules/optimizer/optimizer.routes.js';
import { importRouter } from '../modules/import/import.routes.js';
import { planningRouter } from '../modules/planning/planning.routes.js';

const router = Router();

router.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'backend', timestamp: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/optimizer', optimizerRouter);
router.use('/import', importRouter);
router.use('/planning', planningRouter);

export { router as apiRouter };
