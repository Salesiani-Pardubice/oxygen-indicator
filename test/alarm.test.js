import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { alarmPattern } from '../public/js/alarm-pattern.js';
import { createAlarm } from '../public/js/alarm.js';
import { levelOf } from '../public/js/levels.js';

const miners = (...oxygen) => oxygen.map((value, index) => ({ id: index + 1, oxygen: value }));

test('levelOf classifies oxygen percentages', () => {
  assert.equal(levelOf(80), 'ok');
  assert.equal(levelOf(24), 'low');
  assert.equal(levelOf(9), 'critical');
  assert.equal(levelOf(0), 'empty');
});

test('no alarm while everybody has enough oxygen or the game is paused', () => {
  assert.deepEqual(alarmPattern(miners(80, 60, 40, 25), false), { mode: 'off' });
  assert.deepEqual(alarmPattern(miners(0, 0, 0, 0), true), { mode: 'off' });
});

test('beeps speed up as the most endangered miner runs lower', () => {
  const slow = alarmPattern(miners(80, 24, 80, 80), false);
  const fast = alarmPattern(miners(80, 5, 80, 80), false);
  assert.equal(slow.mode, 'beep');
  assert.equal(fast.mode, 'beep');
  assert.ok(fast.intervalMs < slow.intervalMs);
});

test('a siren sounds once a miner is out of oxygen', () => {
  assert.equal(alarmPattern(miners(80, 80, 0, 80), false).mode, 'siren');
});

test('the pitch identifies the endangered miner', () => {
  const first = alarmPattern(miners(10, 80, 80, 80), false);
  const third = alarmPattern(miners(80, 80, 10, 80), false);
  assert.notEqual(first.frequency, third.frequency);
});

test('the alarm follows the lowest miner when several are low', () => {
  const pattern = alarmPattern(miners(20, 5, 15, 80), false);
  assert.equal(pattern.frequency, alarmPattern(miners(80, 5, 80, 80), false).frequency);
});

test('alarm loop beeps at the pattern interval and stops when switched off', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const tones = [];
  const alarm = createAlarm({ playTone: (frequency, ms) => tones.push([frequency, ms]) });

  alarm.update({ mode: 'beep', frequency: 600, intervalMs: 500 });
  assert.equal(tones.length, 1);
  mock.timers.tick(500);
  assert.equal(tones.length, 2);
  mock.timers.tick(500);
  assert.equal(tones.length, 3);

  alarm.update({ mode: 'off' });
  mock.timers.tick(5000);
  assert.equal(tones.length, 3);
  mock.timers.reset();
});

test('updating with the same mode does not restart the loop', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const tones = [];
  const alarm = createAlarm({ playTone: (frequency) => tones.push(frequency) });

  alarm.update({ mode: 'beep', frequency: 600, intervalMs: 1000 });
  alarm.update({ mode: 'beep', frequency: 600, intervalMs: 900 });
  alarm.update({ mode: 'beep', frequency: 600, intervalMs: 800 });
  assert.equal(tones.length, 1);
  mock.timers.reset();
});

test('the siren alternates between two pitches', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const tones = [];
  const alarm = createAlarm({ playTone: (frequency) => tones.push(frequency) });

  alarm.update({ mode: 'siren', frequency: 600 });
  mock.timers.tick(350);
  mock.timers.tick(350);
  assert.equal(tones.length, 3);
  assert.notEqual(tones[0], tones[1]);
  assert.equal(tones[0], tones[2]);
  alarm.update({ mode: 'off' });
  mock.timers.reset();
});
