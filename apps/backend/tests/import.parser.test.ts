import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRawOrderText } from '../src/modules/import/import.parser.js';

const aliasMap = new Map<string, string>([
  ['rosa', 'rosa'],
  ['kog', 'kogut'],
  ['kogut', 'kogut'],
  ['legh', 'leghorn'],
  ['leghorn', 'leghorn'],
  ['sandy', 'sandy'],
  ['astra', 'astra'],
]);

test('parses sample #1 with slash quantity and simple quantity', () => {
  const parsed = parseRawOrderText('55-320 Malczyce Dworcowa 14/3 660352519 9/39 rosa 1 kog', aliasMap);
  assert.equal(parsed.postalCode, '55-320');
  assert.equal(parsed.phone, '660352519');
  assert.equal(parsed.addressLine, 'Malczyce Dworcowa 14/3');
  assert.deepEqual(
    parsed.items.map((item) => [item.canonicalBreedKey, item.units]),
    [
      ['rosa', 9],
      ['kogut', 1],
    ]
  );
});

test('parses sample #2 with one item', () => {
  const parsed = parseRawOrderText('64-211 Obra Nowa 10b/9 512792216 60/39 rosa', aliasMap);
  assert.equal(parsed.addressLine, 'Obra Nowa 10b/9');
  assert.deepEqual(parsed.items.map((item) => item.units), [60]);
});

test('parses notes from separator', () => {
  const parsed = parseRawOrderText('66-010 Bogaczów Aleja Lipowa 70 533058235 10/39 rosa - ! Pon na 8:00 !', aliasMap);
  assert.equal(parsed.notes, '! Pon na 8:00 !');
});

test('parses another note-heavy row', () => {
  const parsed = parseRawOrderText('87-700 Ośno 69a 695145275 430/36 rosa - ! 17 tyg !', aliasMap);
  assert.equal(parsed.phone, '695145275');
  assert.equal(parsed.notes, '! 17 tyg !');
  assert.equal(parsed.items[0]?.units, 430);
});

test('parses multiple product types', () => {
  const parsed = parseRawOrderText('12-345 Miasto Testowa 1 600700800 10/39 rosa 3 legh 2 sandy 1 astra 4 kogut', aliasMap);
  assert.deepEqual(
    parsed.items.map((item) => [item.canonicalBreedKey, item.units]).sort(),
    [
      ['astra', 1],
      ['kogut', 4],
      ['leghorn', 3],
      ['rosa', 10],
      ['sandy', 2],
    ]
  );
});
