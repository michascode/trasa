import assert from 'node:assert/strict';
import test from 'node:test';
import { getDemoScenario, listDemoScenarios, runOptimization } from '../src/modules/optimizer/optimizer.service.js';

test('optimizer should produce multi-day route plans with route days and stops', async () => {
  const scenario = getDemoScenario('dolny-slask-balanced');
  assert.ok(scenario);

  const result = await runOptimization(scenario.input);

  assert.equal(result.status, 'FEASIBLE');
  assert.equal(result.report.precheck.totalOrders, 18);
  assert.equal(result.report.unassignedOrderIds.length, 0);
  assert.equal(result.routePlans.length, 3);
  assert.ok(result.routePlans.every((plan) => plan.routeDays.length > 0));
  assert.ok(result.routePlans.some((plan) => plan.routeDays.some((day) => day.routeStops.length > 0)));

  const allAssigned = result.routePlans.flatMap((plan) => plan.routeDays.flatMap((day) => day.routeStops.map((stop) => stop.orderId).filter(Boolean)));
  const unique = new Set(allAssigned);
  assert.equal(unique.size, allAssigned.length);
});

test('optimizer should return conflicts and unassigned orders for impossible capacity', async () => {
  const scenario = getDemoScenario('capacity-overflow');
  assert.ok(scenario);

  const result = await runOptimization(scenario.input);

  assert.equal(result.status, 'PARTIAL');
  assert.ok(result.report.unassignedOrderIds.length > 0);
  assert.ok(result.report.conflicts.some((conflict) => conflict.code === 'NO_ELIGIBLE_DRIVER' || conflict.code === 'CAPACITY_EXCEEDED'));
});

test('scenario catalog should expose precheck summary for UI before optimizer run', () => {
  const scenarios = listDemoScenarios();
  const baseline = scenarios.find((scenario) => scenario.id === 'dolny-slask-balanced');

  assert.ok(baseline);
  assert.ok(baseline.precheck.totalOrders > 0);
  assert.ok(baseline.precheck.totalUnits > 0);
  assert.ok(baseline.precheck.totalWorkDays > 0);
});
