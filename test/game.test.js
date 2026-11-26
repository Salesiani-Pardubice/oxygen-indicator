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
