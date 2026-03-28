import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');

const requiredModels = [
  'User',
  'Role',
  'Driver',
  'Vehicle',
  'DriverWeeklyAvailability',
  'PlanningWeek',
  'OrderImportBatch',
  'RawImportedOrderRow',
  'Order',
  'OrderBreedQuantity',
  'BreedAliasDictionary',
  'RoutePlan',
  'RouteDay',
  'RouteStop',
  'RouteManualEditLog',
  'ExternalRouteLink',
  'FuelPriceSetting',
  'SystemSetting',
];

test('schema should contain all required domain entities', () => {
  for (const model of requiredModels) {
    assert.match(schema, new RegExp(`model\\s+${model}\\s+\\{`), `Missing model ${model}`);
  }
});

test('planning week history should be versioned', () => {
  assert.match(schema, /model\s+PlanningWeek\s+\{[\s\S]*version\s+Int/s);
  assert.match(schema, /model\s+PlanningWeek\s+\{[\s\S]*previousVersionId\s+String\?/s);
  assert.match(schema, /@@unique\(\[weekStartDate, version\]\)/);
});

test('orders should support raw and normalized representations + transfer between weeks', () => {
  assert.match(schema, /model\s+RawImportedOrderRow\s+\{[\s\S]*rawOrderText\s+String/s);
  assert.match(schema, /model\s+RawImportedOrderRow\s+\{[\s\S]*normalizedOrderId\s+String\?/s);
  assert.match(schema, /model\s+Order\s+\{[\s\S]*rawOrderText\s+String/s);
  assert.match(schema, /model\s+OrderWeekAssignment\s+\{/);
  assert.match(schema, /model\s+OrderWeekAssignment\s+\{[\s\S]*isCurrent\s+Boolean/s);
});

test('route model should include required route attributes and audit log', () => {
  assert.match(schema, /model\s+RoutePlan\s+\{[\s\S]*driverId\s+String/s);
  assert.match(schema, /model\s+RouteDay\s+\{[\s\S]*dayIndex\s+Int/s);
  assert.match(schema, /model\s+RouteStop\s+\{[\s\S]*sequenceNo\s+Int/s);
  assert.match(schema, /model\s+RoutePlan\s+\{[\s\S]*totalKm\s+Decimal/s);
  assert.match(schema, /model\s+RoutePlan\s+\{[\s\S]*status\s+RoutePlanStatus/s);
  assert.match(schema, /model\s+RouteManualEditLog\s+\{[\s\S]*beforeJson\s+Json/s);
  assert.match(schema, /model\s+RouteManualEditLog\s+\{[\s\S]*afterJson\s+Json/s);
});
