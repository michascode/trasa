import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { pushAuditEvent } from '../modules/observability/audit-trail.js';
import { log } from '../modules/observability/logger.js';

export function notFoundHandler(req: Request, res: Response) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} nie istnieje.`,
    },
  });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Niepoprawne dane wejściowe.',
        details: error.flatten(),
      },
    });
  }

  const message = error instanceof Error ? error.message : 'Nieznany błąd serwera.';
  log('error', 'Unhandled API error', { method: req.method, path: req.originalUrl, message });
  pushAuditEvent({
    action: 'HTTP_ERROR',
    status: 'failure',
    resource: req.originalUrl,
    details: { method: req.method, message },
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}
