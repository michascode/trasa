import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { optimizerRouter } from '../modules/optimizer/optimizer.routes.js';
import { importRouter } from '../modules/import/import.routes.js';
import { planningRouter } from '../modules/planning/planning.routes.js';
import { listAuditEvents } from '../modules/observability/audit-trail.js';

const router = Router();

router.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'backend', timestamp: new Date().toISOString() });
});

router.get('/audit/events', (req, res) => {
  const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
  res.json({ events: listAuditEvents(limit) });
});

router.use('/auth', authRouter);
router.use('/optimizer', optimizerRouter);
router.use('/import', importRouter);
router.use('/planning', planningRouter);

export { router as apiRouter };
