import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyManualEdit,
  archivePlanningWeek,
  createPlanningWeek,
  resetPlanningState,
  selectOrdersForWeek,
} from '../../src/modules/planning/planning.service.js';

test.beforeEach(() => {
  resetPlanningState();
});

test('planning should reject invalid date week creation', () => {
  assert.throws(() => createPlanningWeek('not-a-date'), /Niepoprawna data tygodnia/);
});

test('planning should reject manual add duplicate order on same driver', () => {
  const week = createPlanningWeek('2026-03-24');
  selectOrdersForWeek(week.id, ['ord-1']);

  assert.throws(
    () =>
      applyManualEdit(week.id, {
        action: 'ADD_STOP',
        actor: 'manager@test',
        day: 1,
        driverId: 'drv-1',
        orderId: 'ord-1',
      }),
    /Zamówienie już istnieje na trasie kierowcy/,
  );
});

test('planning should lock week after archive', () => {
  const week = createPlanningWeek('2026-03-24');
  archivePlanningWeek(week.id);

  assert.throws(() => selectOrdersForWeek(week.id, ['ord-1']), /Tydzień jest zablokowany jako archiwum/);
});
