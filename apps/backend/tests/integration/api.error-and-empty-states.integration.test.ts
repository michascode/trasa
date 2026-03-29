import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetAuditEvents } from '../../src/modules/observability/audit-trail.js';

test.beforeEach(() => {
  resetAuditEvents();
});

test('api should return consistent JSON errors for not found and validation cases', async () => {
  const app = createApp();

  const notFound = await request(app).get('/api/does-not-exist');
  assert.equal(notFound.status, 404);
  assert.equal(notFound.body.error.code, 'NOT_FOUND');

  const badPayload = await request(app).post('/api/planning/weeks').send({ weekStartDate: 123 });
  assert.equal(badPayload.status, 400);
  assert.equal(badPayload.body.error.code, 'VALIDATION_ERROR');
});

test('api should expose audit events endpoint including request lifecycle', async () => {
  const app = createApp();

  await request(app).get('/api/health').expect(200);
  const auditResponse = await request(app).get('/api/audit/events?limit=10').expect(200);

  assert.ok(Array.isArray(auditResponse.body.events));
  assert.ok(auditResponse.body.events.length > 0);
  assert.ok(auditResponse.body.events.some((event: { action: string }) => event.action === 'HTTP_REQUEST'));
});
