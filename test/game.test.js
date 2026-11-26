import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../server/game.js';

function createTestGame(options) {
  let now = 0;
  const game = createGame({ clock: () => now, ...options });
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
