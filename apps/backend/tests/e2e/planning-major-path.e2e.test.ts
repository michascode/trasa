import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetPlanningState } from '../../src/modules/planning/planning.service.js';

test.beforeEach(() => {
  resetPlanningState();
});

test('e2e: manager workflow should create week, assign driver, plan orders, edit route and export', async () => {
  const app = createApp();

  const weekResponse = await request(app).post('/api/planning/weeks').send({ weekStartDate: '2026-03-24' }).expect(201);
  const weekId = weekResponse.body.id;

  await request(app).post(`/api/planning/weeks/${weekId}/drivers`).send({ driverId: 'drv-1', workDaysCount: 5 }).expect(200);
  await request(app).put(`/api/planning/weeks/${weekId}/orders`).send({ orderIds: ['ord-1', 'ord-2', 'ord-3'] }).expect(200);

  const before = await request(app).get(`/api/planning/weeks/${weekId}`).expect(200);
  const firstStop = before.body.routePlans[0].days[0].stops[0];
  assert.ok(firstStop);

  await request(app)
    .post(`/api/planning/weeks/${weekId}/manual-edit`)
    .send({
      action: 'MOVE_DAY',
      actor: 'manager@trasa.local',
      driverId: 'drv-1',
      orderId: firstStop.orderId,
      fromDay: 1,
      toDay: 2,
      reason: 'konflikt czasowy',
    })
    .expect(200);

  const after = await request(app).get(`/api/planning/weeks/${weekId}`).expect(200);
  assert.ok(after.body.auditLog.length > 0);
  assert.ok(after.body.dayDiff.length === 7);

  const exportResponse = await request(app).get(`/api/planning/weeks/${weekId}/export/week`).expect(200);
  assert.match(exportResponse.headers['content-type'], /text\/csv/);
});
