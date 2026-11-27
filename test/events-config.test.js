import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEventDefs, validateEventDefs } from '../server/events-config.js';

test('the bundled events.json is valid', () => {
  const defs = loadEventDefs();
  assert.ok(defs.length >= 1);
  assert.ok(defs.some((def) => def.durationSec === null), 'has an event that runs until ended');
});

test('a missing durationSec means "until ended"', () => {
  const [def] = validateEventDefs([{ id: 'a', label: 'A', multiplier: 2 }]);
  assert.equal(def.durationSec, null);
});

test('invalid definitions are rejected with a readable message', () => {
  const ok = { id: 'a', label: 'A', multiplier: 2, durationSec: 10 };
  assert.throws(() => validateEventDefs({}), /array/);
  assert.throws(() => validateEventDefs([{ ...ok, id: '' }]), /"id"/);
  assert.throws(() => validateEventDefs([ok, ok]), /duplicate/);
  assert.throws(() => validateEventDefs([{ ...ok, label: 3 }]), /"label"/);
  assert.throws(() => validateEventDefs([{ ...ok, multiplier: 0 }]), /multiplier/);
  assert.throws(() => validateEventDefs([{ ...ok, multiplier: 11 }]), /multiplier/);
  assert.throws(() => validateEventDefs([{ ...ok, durationSec: 1 }]), /durationSec/);
  assert.throws(() => validateEventDefs([{ ...ok, durationSec: '10' }]), /durationSec/);
});
