import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { pushAuditEvent } from '../modules/observability/audit-trail.js';
import { log } from '../modules/observability/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const meta = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };

    log(res.statusCode >= 500 ? 'error' : 'info', 'HTTP request completed', meta);
    pushAuditEvent({
      action: 'HTTP_REQUEST',
      status: res.statusCode >= 400 ? 'failure' : 'success',
      resource: req.originalUrl,
      details: meta,
    });
  });

  next();
}
