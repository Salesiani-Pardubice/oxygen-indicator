import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, latestLogId, newExpiries } from '../public/js/log.js';

const log = [{ id: 1 }, { id: 2 }, { id: 5 }];

test('newExpiries returns only entries newer than the last seen id', () => {
  assert.deepEqual(newExpiries(log, 2), [{ id: 5 }]);
  assert.deepEqual(newExpiries(log, 5), []);
  assert.equal(newExpiries(log, 0).length, 3);
});

test('latestLogId is the highest id, or 0 for an empty log', () => {
  assert.equal(latestLogId(log), 5);
  assert.equal(latestLogId([]), 0);
});

test('formatClock prints the local time of day as HH:MM:SS', () => {
  assert.equal(formatClock(new Date(2026, 10, 27, 9, 3, 7).getTime()), '09:03:07');
  assert.equal(formatClock(new Date(2026, 10, 27, 23, 59, 59).getTime()), '23:59:59');
});
