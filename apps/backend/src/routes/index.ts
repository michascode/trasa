import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { optimizerRouter } from '../modules/optimizer/optimizer.routes.js';

const router = Router();

router.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'backend', timestamp: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/optimizer', optimizerRouter);

export { router as apiRouter };
