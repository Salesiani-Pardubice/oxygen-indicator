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
