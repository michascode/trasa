import { randomUUID } from 'node:crypto';

export type AuditAction =
  | 'HTTP_REQUEST'
  | 'HTTP_ERROR'
  | 'PLANNING_MANUAL_EDIT'
  | 'IMPORT_UPLOAD'
  | 'IMPORT_CORRECTION';

export type AuditEvent = {
  id: string;
  timestamp: string;
  action: AuditAction;
  actor?: string;
  status: 'success' | 'failure';
  resource?: string;
  details?: Record<string, unknown>;
};

const events: AuditEvent[] = [];
const MAX_EVENTS = 1000;

export function pushAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>) {
  events.unshift({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  });

  if (events.length > MAX_EVENTS) {
    events.splice(MAX_EVENTS);
  }
}

export function listAuditEvents(limit = 100) {
  return events.slice(0, Math.max(1, Math.min(limit, MAX_EVENTS)));
}

export function resetAuditEvents() {
  events.splice(0, events.length);
}
