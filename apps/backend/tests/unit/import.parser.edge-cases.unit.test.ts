import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRawOrderText } from '../../src/modules/import/import.parser.js';

const aliasMap = new Map<string, string>([
  ['rosa', 'rosa'],
  ['kogut', 'kogut'],
  ['sandy', 'sandy'],
]);

test('parser should return unknown aliases and fallback fields for edge cases', () => {
  const parsed = parseRawOrderText('55-100 Testowa 1 600700800 0 rosa 2 nieznana - notatka', aliasMap, {
    address: 'Adres awaryjny 5',
    phone: '999888777',
    notes: 'wymuszone notatki',
  });

  assert.equal(parsed.addressLine, 'Adres awaryjny 5');
  assert.equal(parsed.phone, '999888777');
  assert.equal(parsed.notes, 'wymuszone notatki');
  assert.deepEqual(parsed.items.map((item) => [item.canonicalBreedKey, item.units]), [['rosa', 0]]);
  assert.deepEqual(parsed.unknownAliases, ['nieznana']);
});

test('parser should aggregate repeated aliases and keep postal code null when missing', () => {
  const parsed = parseRawOrderText('Miejscowosc 700800900 2 rosa 3 rosa 1 kogut', aliasMap);

  assert.equal(parsed.postalCode, null);
  assert.equal(parsed.phone, '700800900');
  assert.deepEqual(
    parsed.items.map((item) => [item.canonicalBreedKey, item.units]).sort(),
    [
      ['kogut', 1],
      ['rosa', 5],
    ],
  );
});
