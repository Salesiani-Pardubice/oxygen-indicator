import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../server/game.js';

function createTestGame(options) {
  let now = 0;
  const game = createGame({ clock: () => now, startPaused: false, ...options });
  const advance = (seconds) => {
    now += seconds * 1000;
    game.tick();
  };
  return { game, advance };
}

test('starts with 4 miners at full oxygen', () => {
  const { game } = createTestGame();
  const { miners } = game.snapshot();
  assert.equal(miners.length, 4);
  assert.deepEqual(
    miners.map((m) => m.oxygen),
    [100, 100, 100, 100],
  );
  assert.equal(miners[0].name, 'Horník 1');
});

test('a full mask lasts 2 minutes on the standard preset', () => {
  const { game, advance } = createTestGame();
  advance(60);
  assert.equal(game.snapshot().miners[0].oxygen, 50);
  advance(60);
  assert.equal(game.snapshot().miners[0].oxygen, 0);
});

test('oxygen never goes below zero', () => {
  const { game, advance } = createTestGame();
  advance(1000);
  assert.equal(game.snapshot().miners[0].oxygen, 0);
});

test('snapshot exposes the depletion rate in percent per second', () => {
  const { game } = createTestGame();
  assert.equal(game.snapshot().miners[0].rate, 0.83);
});

test('each click adds a fixed amount of oxygen, capped at 100', () => {
  const { game, advance } = createTestGame();
  advance(60); // 50 %
  game.startRefill(1, 'pc');
  advance(0.1);
  const result = game.refillClick('pc');
  assert.equal(result.applied, true);
  assert.ok(result.oxygen > 50.9 && result.oxygen < 51.1);
});

test('only one client can hold the refill lock at a time', () => {
  const { game } = createTestGame();
  assert.equal(game.startRefill(1, 'a').ok, true);
  assert.deepEqual(game.startRefill(2, 'b'), { ok: false, error: 'busy' });
  assert.equal(game.startRefill(2, 'a').ok, true); // the owner may switch miners
  assert.equal(game.snapshot().refill.minerId, 2);
});

test('clicks without holding the lock are rejected', () => {
  const { game } = createTestGame();
  assert.deepEqual(game.refillClick('a'), { ok: false, error: 'not-refilling' });
  game.startRefill(1, 'a');
  assert.deepEqual(game.refillClick('b'), { ok: false, error: 'not-refilling' });
});

test('unknown miners cannot be refilled', () => {
  const { game } = createTestGame();
  assert.deepEqual(game.startRefill(99, 'a'), { ok: false, error: 'unknown-miner' });
});

test('clicks faster than ~12 per second are ignored', () => {
  const { game, advance } = createTestGame();
  advance(60);
  game.startRefill(1, 'a');
  advance(0.1);
  assert.equal(game.refillClick('a').applied, true);
  advance(0.02);
  assert.equal(game.refillClick('a').applied, false);
  advance(0.1);
  assert.equal(game.refillClick('a').applied, true);
});

test('the lock is released after 10 seconds without clicks', () => {
  const { game, advance } = createTestGame();
  game.startRefill(1, 'a');
  advance(9);
  assert.notEqual(game.snapshot().refill, null);
  advance(2);
  assert.equal(game.snapshot().refill, null);
  assert.equal(game.startRefill(2, 'b').ok, true);
});

test('clicking keeps the lock alive', () => {
  const { game, advance } = createTestGame();
  game.startRefill(1, 'a');
  for (let i = 0; i < 4; i++) {
    advance(8);
    game.refillClick('a');
  }
  assert.notEqual(game.snapshot().refill, null);
});

test('the lock is released automatically when the miner is full', () => {
  const { game, advance } = createTestGame();
  game.startRefill(1, 'a');
  advance(0.1); // ~99.9 %, so a single click reaches the cap
  const result = game.refillClick('a');
  assert.equal(result.oxygen, 100);
  assert.equal(result.done, true);
  assert.equal(game.snapshot().refill, null);
});

test('stopRefill releases the lock only for its owner', () => {
  const { game } = createTestGame();
  game.startRefill(1, 'a');
  game.stopRefill('b');
  assert.notEqual(game.snapshot().refill, null);
  game.stopRefill('a');
  assert.equal(game.snapshot().refill, null);
});

test('starts paused by default and does not deplete while paused', () => {
  const { game, advance } = createTestGame({ startPaused: true });
  assert.equal(game.snapshot().paused, true);
  advance(60);
  assert.equal(game.snapshot().miners[0].oxygen, 100);

  game.setPaused(false);
  advance(60);
  assert.equal(game.snapshot().miners[0].oxygen, 50);

  game.setPaused(true);
  advance(60);
  assert.equal(game.snapshot().miners[0].oxygen, 50);
});

test('presets change how fast a miner runs out, per miner', () => {
  const { game, advance } = createTestGame();
  game.setPreset(1, 'sleep');
  game.setPreset(2, 'work');
  advance(60);
  const [sleeping, working, normal] = game.snapshot().miners;
  assert.equal(sleeping.oxygen, 75);
  assert.equal(working.oxygen, 0);
  assert.equal(normal.oxygen, 50);
});

test('a preset can be set for all miners at once', () => {
  const { game } = createTestGame();
  game.setPreset('all', 'work');
  assert.ok(game.snapshot().miners.every((miner) => miner.preset === 'work'));
});

test('the global speed multiplies depletion', () => {
  const { game, advance } = createTestGame();
  game.setSpeed(2);
  advance(30);
  assert.equal(game.snapshot().miners[0].oxygen, 50);
});

test('preset durations are adjustable', () => {
  const { game, advance } = createTestGame();
  game.setPresetSeconds('standard', 200);
  advance(100);
  assert.equal(game.snapshot().miners[0].oxygen, 50);
  assert.equal(game.adminSnapshot().settings.presetSeconds.standard, 200);
});

test('the number of miners can be 4 to 6; new miners start full', () => {
  const { game, advance } = createTestGame();
  advance(60);
  assert.equal(game.setMinerCount(6).ok, true);
  const { miners } = game.snapshot();
  assert.equal(miners.length, 6);
  assert.equal(miners[4].oxygen, 100); // a new miner starts with a full mask
  assert.equal(miners[4].name, 'Horník 5');
  assert.equal(game.setMinerCount(4).ok, true);
  assert.equal(game.snapshot().miners.length, 4);
});

test('miner counts outside 4 to 6 are rejected', () => {
  const { game } = createTestGame();
  for (const count of [3, 7, 4.5, '5', null]) {
    assert.equal(game.setMinerCount(count).error, 'invalid');
  }
  assert.equal(game.snapshot().miners.length, 4);
});

test('shrinking the miner count releases a refill lock on a removed miner', () => {
  const { game } = createTestGame({ minerCount: 6 });
  game.startRefill(6, 'a');
  game.setMinerCount(4);
  assert.equal(game.snapshot().refill, null);
});

test('miners can be renamed; blank names fall back to the default and long names are cut', () => {
  const { game } = createTestGame();
  game.renameMiner(2, '  Karel  ');
  assert.equal(game.snapshot().miners[1].name, 'Karel');
  game.renameMiner(2, '   ');
  assert.equal(game.snapshot().miners[1].name, 'Horník 2');
  game.renameMiner(2, 'x'.repeat(50));
  assert.equal(game.snapshot().miners[1].name.length, 20);
  assert.equal(game.renameMiner(99, 'Nikdo').error, 'unknown-miner');
});

test('invalid settings are rejected and leave the state untouched', () => {
  const { game } = createTestGame();
  assert.equal(game.setSpeed(0).error, 'invalid');
  assert.equal(game.setSpeed(Infinity).error, 'invalid');
  assert.equal(game.setSpeed('2').error, 'invalid');
  assert.equal(game.setPresetSeconds('standard', 1).error, 'invalid');
  assert.equal(game.setPresetSeconds('nap', 100).error, 'invalid');
  assert.equal(game.setRefillPerClick(0).error, 'invalid');
  assert.equal(game.setPreset(1, 'nap').error, 'invalid');
  assert.equal(game.setPaused('yes').error, 'invalid');
  assert.equal(game.snapshot().speed, 1);
});

test('refill per click is adjustable', () => {
  const { game, advance } = createTestGame();
  advance(60);
  game.setRefillPerClick(5);
  game.startRefill(1, 'a');
  assert.equal(game.refillClick('a').oxygen, 55);
});

test('resetGame refills everybody, pauses and releases the lock, but keeps names and presets', () => {
  const { game, advance } = createTestGame();
  game.renameMiner(1, 'Karel');
  game.setPreset(1, 'work');
  advance(30);
  game.startRefill(1, 'a');
  game.resetGame();
  const snapshot = game.snapshot();
  assert.equal(snapshot.paused, true);
  assert.equal(snapshot.refill, null);
  assert.ok(snapshot.miners.every((miner) => miner.oxygen === 100));
  assert.equal(snapshot.miners[0].name, 'Karel');
  assert.equal(snapshot.miners[0].preset, 'work');
});

const EVENT_DEFS = [
  { id: 'bomb', label: 'Prasklá bomba', multiplier: 2, durationSec: 60 },
  { id: 'collapse', label: 'Zával', multiplier: 1.5, durationSec: null },
  { id: 'ventilation', label: 'Ventilace', multiplier: 0.5, durationSec: 90 },
];

const eventGame = () => createTestGame({ eventDefs: EVENT_DEFS });

test('an event multiplies depletion for everybody by default', () => {
  const { game, advance } = eventGame();
  assert.equal(game.startEvent('bomb').ok, true);
  advance(10);
  assert.equal(game.snapshot().miners[0].oxygen, 83.33);
  assert.equal(game.snapshot().miners[0].boost, 2);
});

test('an event ends by itself and depletion returns to normal', () => {
  const { game, advance } = eventGame();
  game.startEvent('bomb', { durationSec: 30 });
  advance(30); // 30 s at x2 = 50 %
  assert.equal(game.snapshot().events.length, 0);
  assert.equal(game.snapshot().miners[0].oxygen, 50);
  advance(30); // back to x1 = another 25 %
  assert.equal(game.snapshot().miners[0].oxygen, 25);
});

test('a long gap between ticks is split at the end of the event', () => {
  const { game, advance } = eventGame();
  game.startEvent('bomb', { durationSec: 10 });
  advance(40); // 10 s at x2 (16.67 %) + 30 s at x1 (25 %)
  assert.equal(game.snapshot().miners[0].oxygen, 58.33);
});

test('an event without duration runs until it is ended by hand', () => {
  const { game, advance } = eventGame();
  const { id } = game.startEvent('collapse');
  advance(3000);
  assert.equal(game.snapshot().events.length, 1);
  assert.equal(game.snapshot().events[0].remainingSec, null);
  assert.deepEqual(game.endEvent(id), { ok: true });
  assert.equal(game.snapshot().events.length, 0);
});

test('the duration can be overridden, or removed with null', () => {
  const { game } = eventGame();
  game.startEvent('bomb', { durationSec: 20 });
  game.startEvent('bomb', { durationSec: null });
  game.startEvent('collapse', { durationSec: 45 });
  const [custom, forever, collapse] = game.snapshot().events;
  assert.equal(custom.remainingSec, 20);
  assert.equal(forever.remainingSec, null);
  assert.equal(collapse.remainingSec, 45);
});

test('an event can target selected miners only', () => {
  const { game, advance } = eventGame();
  game.startEvent('bomb', { targets: [2, 3] });
  advance(30);
  const boosts = game.snapshot().miners.map((miner) => miner.boost);
  assert.deepEqual(boosts, [1, 2, 2, 1]);
  const oxygen = game.snapshot().miners.map((miner) => miner.oxygen);
  assert.deepEqual(oxygen, [75, 50, 50, 75]);
});

test('overlapping events multiply', () => {
  const { game } = eventGame();
  game.startEvent('bomb');
  game.startEvent('ventilation');
  game.startEvent('collapse');
  assert.equal(game.snapshot().miners[0].boost, 1.5); // 2 * 0.5 * 1.5
});

test('event timers freeze while the game is paused', () => {
  const { game, advance } = eventGame();
  game.startEvent('bomb', { durationSec: 30 });
  advance(10);
  game.setPaused(true);
  advance(100);
  assert.equal(game.snapshot().events[0].remainingSec, 20);
  game.setPaused(false);
  advance(20);
  assert.equal(game.snapshot().events.length, 0);
});

test('invalid events are rejected', () => {
  const { game } = eventGame();
  assert.equal(game.startEvent('nope').error, 'invalid');
  assert.equal(game.startEvent('bomb', { durationSec: 1 }).error, 'invalid');
  assert.equal(game.startEvent('bomb', { durationSec: 99999 }).error, 'invalid');
  assert.equal(game.startEvent('bomb', { targets: [] }).error, 'invalid');
  assert.equal(game.startEvent('bomb', { targets: [9] }).error, 'invalid');
  assert.equal(game.startEvent('bomb', { targets: [1, 1] }).error, 'invalid');
  assert.equal(game.startEvent('bomb', { targets: 'some' }).error, 'invalid');
  assert.equal(game.snapshot().events.length, 0);
  assert.equal(game.endEvent(42).error, 'unknown-event');
});

test('events aimed at removed miners disappear when the miner count shrinks', () => {
  const { game } = createTestGame({ eventDefs: EVENT_DEFS, minerCount: 6 });
  game.startEvent('bomb', { targets: [5, 6] });
  game.startEvent('bomb', { targets: [1, 6] });
  game.setMinerCount(4);
  const events = game.snapshot().events;
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].targets, [1]);
});

test('resetGame ends all events', () => {
  const { game } = eventGame();
  game.startEvent('bomb');
  game.resetGame();
  assert.equal(game.snapshot().events.length, 0);
});

test('the admin snapshot lists the event definitions', () => {
  const { game } = eventGame();
  assert.equal(game.adminSnapshot().eventDefs.length, 3);
});
