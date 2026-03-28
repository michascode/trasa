import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetPlanningState } from '../src/modules/planning/planning.service.js';

test.beforeEach(() => {
  resetPlanningState();
});

test('weekly planning workflow should support assignment, transfer, statuses and archive lock', async () => {
  const app = createApp();

  const previousWeekResponse = await request(app)
    .post('/api/planning/weeks')
    .send({ weekStartDate: '2026-03-10' });
  assert.equal(previousWeekResponse.status, 201);
  assert.equal(previousWeekResponse.body.weekStartDate, '2026-03-09');
  const previousWeekId = previousWeekResponse.body.id;

  const currentWeekResponse = await request(app)
    .post('/api/planning/weeks')
    .send({ weekStartDate: '2026-03-17' });
  assert.equal(currentWeekResponse.status, 201);
  assert.equal(currentWeekResponse.body.weekStartDate, '2026-03-16');
  const currentWeekId = currentWeekResponse.body.id;

  await request(app)
    .put(`/api/planning/weeks/${previousWeekId}/orders`)
    .send({ orderIds: ['ord-1', 'ord-2'] })
    .expect(200);

  await request(app)
    .patch(`/api/planning/weeks/${previousWeekId}/orders/ord-1/status`)
    .send({ status: 'planned' })
    .expect(200);

  await request(app)
    .post(`/api/planning/weeks/${currentWeekId}/drivers`)
    .send({ driverId: 'drv-1', workDaysCount: 4 })
    .expect(200);

  await request(app)
    .patch(`/api/planning/weeks/${currentWeekId}/drivers/drv-1/work-days`)
    .send({ workDaysCount: 5 })
    .expect(200);

  await request(app)
    .put(`/api/planning/weeks/${currentWeekId}/orders`)
    .send({ orderIds: ['ord-3', 'ord-4'] })
    .expect(200);

  await request(app)
    .patch(`/api/planning/weeks/${currentWeekId}/orders/ord-3/status`)
    .send({ status: 'conflict' })
    .expect(200);

  await request(app)
    .patch(`/api/planning/weeks/${currentWeekId}/orders/ord-4/status`)
    .send({ status: 'planned' })
    .expect(200);

  await request(app)
    .post(`/api/planning/weeks/${currentWeekId}/orders/transfer`)
    .send({ orderIds: ['ord-2'] })
    .expect(200);

  const weekDetails = await request(app).get(`/api/planning/weeks/${currentWeekId}`).expect(200);

  assert.equal(weekDetails.body.previousWeekId, previousWeekId);
  assert.deepEqual(weekDetails.body.drivers, [
    {
      driverId: 'drv-1',
      driverName: 'Jan Kowalski',
      workDaysCount: 5,
    },
  ]);

  const statuses = new Map(weekDetails.body.orders.map((order: { orderId: string; status: string }) => [order.orderId, order.status]));
  assert.equal(statuses.get('ord-2'), 'moved');
  assert.equal(statuses.get('ord-3'), 'conflict');
  assert.equal(statuses.get('ord-4'), 'planned');

  assert.deepEqual(weekDetails.body.orderStatusCounts, {
    unassigned: 0,
    planned: 1,
    conflict: 1,
    moved: 1,
    skipped: 0,
  });

  await request(app).post(`/api/planning/weeks/${currentWeekId}/archive`).expect(200);
  await request(app).delete(`/api/planning/weeks/${currentWeekId}/drivers/drv-1`).expect(500);
});

test('manual dispatcher edits should move, resequence, remove, add and audit changes with diff and warnings', async () => {
  const app = createApp();
  const weekResponse = await request(app).post('/api/planning/weeks').send({ weekStartDate: '2026-03-24' }).expect(201);
  const weekId = weekResponse.body.id;

  await request(app).post(`/api/planning/weeks/${weekId}/drivers`).send({ driverId: 'drv-1', workDaysCount: 5 }).expect(200);
  await request(app).put(`/api/planning/weeks/${weekId}/orders`).send({ orderIds: ['ord-1', 'ord-2', 'ord-3'] }).expect(200);

  const before = await request(app).get(`/api/planning/weeks/${weekId}`).expect(200);
  const stop = before.body.routePlans[0].days[0].stops[0];

  await request(app)
    .post(`/api/planning/weeks/${weekId}/manual-edit`)
    .send({
      action: 'RESEQUENCE_STOP',
      actor: 'manager@test',
      driverId: 'drv-1',
      day: 1,
      stopId: stop.id,
      toSequence: 1,
    })
    .expect(200);

  await request(app)
    .post(`/api/planning/weeks/${weekId}/manual-edit`)
    .send({
      action: 'MOVE_DAY',
      actor: 'manager@test',
      driverId: 'drv-1',
      orderId: stop.orderId,
      fromDay: 1,
      toDay: 2,
    })
    .expect(200);

  const afterMove = await request(app).get(`/api/planning/weeks/${weekId}`).expect(200);
  const movedStop = afterMove.body.routePlans[0].days[1].stops.find((entry: { orderId: string }) => entry.orderId === stop.orderId);
  assert.ok(movedStop);

  await request(app)
    .post(`/api/planning/weeks/${weekId}/manual-edit`)
    .send({
      action: 'REMOVE_STOP',
      actor: 'manager@test',
      driverId: 'drv-1',
      day: 2,
      stopId: movedStop.id,
    })
    .expect(200);

  await request(app)
    .post(`/api/planning/weeks/${weekId}/manual-edit`)
    .send({
      action: 'ADD_STOP',
      actor: 'manager@test',
      driverId: 'drv-1',
      day: 3,
      orderId: stop.orderId,
    })
    .expect(200);

  const finalDetails = await request(app).get(`/api/planning/weeks/${weekId}`).expect(200);
  assert.ok(finalDetails.body.auditLog.length >= 4);
  assert.equal(typeof finalDetails.body.weeklyDiff.delta.km, 'number');
  assert.ok(Array.isArray(finalDetails.body.dayDiff));
  assert.ok(Array.isArray(finalDetails.body.weeklyDiff.warnings));
});
