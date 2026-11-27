import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGame } from '../server/game.js';
import { createStore } from '../server/store.js';
import { createPersister } from '../server/persistence.js';

const EVENT_DEFS = [{ id: 'bomb', label: 'Prasklá bomba', multiplier: 2, durationSec: 60 }];

function createTestGame(options) {
  let now = 0;
  const game = createGame({
    clock: () => now,
    wallClock: () => 1_000_000 + now,
    startPaused: false,
    eventDefs: EVENT_DEFS,
    ...options,
  });
  const advance = (seconds) => {
    now += seconds * 1000;
    game.tick();
  };
  return { game, advance };
}

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'oxygen-test-')), 'data', 'state.json');
const roundTrip = (game) => JSON.parse(JSON.stringify(game.serialize()));

test('a saved game comes back with the same settings, oxygen, events and log, but paused', () => {
  const { game, advance } = createTestGame({ minerCount: 5 });
  game.renameMiner(1, 'Karel');
  game.setPreset(2, 'work');
  game.setSpeed(1.5);
  game.setPresetSeconds('standard', 150);
  game.setRefillPerClick(2);
  game.startEvent('bomb', { targets: [1, 3], durationSec: 45 });
  game.startEvent('bomb', { durationSec: null });
  advance(100);

  const before = game.adminSnapshot();
  const { game: restored } = createTestGame({ restore: roundTrip(game) });
  const after = restored.adminSnapshot();

  assert.equal(after.paused, true);
  assert.deepEqual(after.miners, before.miners);
  assert.deepEqual(after.events, before.events);
  // zeroSeconds is derived from the wall clock at snapshot time, so compare the stored fields only
  const stored = (log) => log.map(({ zeroSeconds, ...entry }) => entry);
  assert.ok(before.log.length > 0);
  assert.deepEqual(stored(after.log), stored(before.log));
  assert.deepEqual(after.settings, before.settings);
  assert.equal(after.speed, 1.5);
});

test('the log and its id counter survive a restart', () => {
  const { game, advance } = createTestGame();
  advance(150);
  const { game: restored, advance: advanceRestored } = createTestGame({ restore: roundTrip(game) });
  assert.equal(restored.adminSnapshot().log.length, 4);

  restored.setPaused(false);
  restored.startRefill(1, 'a');
  advanceRestored(0.1);
  restored.refillClick('a');
  advanceRestored(200); // runs out again -> a new entry with a fresh id
  const ids = restored.adminSnapshot().log.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('restored events keep running after the game is started again', () => {
  const { game, advance } = createTestGame();
  game.startEvent('bomb', { durationSec: 30 });
  advance(10);
  const { game: restored, advance: advanceRestored } = createTestGame({ restore: roundTrip(game) });
  assert.equal(restored.snapshot().events[0].remainingSec, 20);
  restored.setPaused(false);
  advanceRestored(20);
  assert.equal(restored.snapshot().events.length, 0);
});

test('damaged saves are rejected with a message', () => {
  const { game } = createTestGame();
  const good = roundTrip(game);
  const bad = (change) => () => createGame({ restore: change(structuredClone(good)) });

  assert.throws(() => createGame({ restore: 'nope' }), /not an object/);
  assert.throws(bad((d) => ({ ...d, version: 2 })), /version/);
  assert.throws(bad((d) => ({ ...d, speed: 0 })), /speed/);
  assert.throws(bad((d) => ({ ...d, speed: '2' })), /speed/);
  assert.throws(bad((d) => ({ ...d, presetSeconds: { sleep: 1, standard: 120, work: 60 } })), /presetSeconds/);
  assert.throws(bad((d) => ({ ...d, miners: d.miners.slice(0, 2) })), /miners/);
  assert.throws(bad((d) => (d.miners[0].oxygen = 150, d)), /oxygen/);
  assert.throws(bad((d) => (d.miners[0].preset = 'nap', d)), /preset/);
  assert.throws(bad((d) => (d.miners[1].id = 7, d)), /id/);
  assert.throws(bad((d) => ({ ...d, events: [{ id: 1 }] })), /event/);
  assert.throws(bad((d) => ({ ...d, events: [{ id: 1, defId: 'b', label: 'B', multiplier: 2, targets: [9], remainingMs: null }], nextEventId: 2 })), /targets/);
  assert.throws(bad((d) => ({ ...d, log: [{ id: 1 }], nextLogId: 2 })), /log/);
  assert.throws(bad((d) => ({ ...d, log: [{ id: 5, minerId: 1, minerName: 'x', expiredAt: 1, recoveredAt: null }], nextLogId: 2 })), /nextLogId/);
});

test('the store writes atomically, creates the folder and reads back what was saved', () => {
  const path = tempFile();
  const store = createStore(path);
  assert.equal(store.load(), null);
  store.save({ a: 1 });
  assert.deepEqual(store.load(), { a: 1 });
  assert.equal(existsSync(`${path}.tmp`), false);
});

test('a damaged file throws on load and can be set aside', () => {
  const path = tempFile();
  const store = createStore(path);
  store.save({ a: 1 });
  writeFileSync(path, '{ not json');
  assert.throws(() => store.load(), SyntaxError);
  store.quarantine();
  assert.equal(store.load(), null);
  assert.equal(readFileSync(`${path}.broken`, 'utf8'), '{ not json');
});

test('the persister saves only when something changed', () => {
  const { game, advance } = createTestGame({ startPaused: true });
  const saved = [];
  const persister = createPersister({ game, store: { save: (data) => saved.push(data) } });
  persister.markLoaded();

  assert.equal(persister.saveIfChanged(), false); // nothing changed since loading
  game.renameMiner(1, 'Karel');
  assert.equal(persister.saveIfChanged(), true);
  assert.equal(persister.saveIfChanged(), false);
  advance(30); // paused: oxygen unchanged
  assert.equal(persister.saveIfChanged(), false);
  game.setPaused(false);
  advance(30);
  assert.equal(persister.saveIfChanged(), true);
  assert.equal(saved.length, 2);
});

test('a failing disk is reported once and saving resumes when it recovers', () => {
  const { game } = createTestGame();
  const messages = [];
  let broken = true;
  const store = {
    save() {
      if (broken) throw new Error('disk full');
    },
  };
  const persister = createPersister({
    game,
    store,
    log: { warn: (m) => messages.push(['warn', m]), log: (m) => messages.push(['log', m]) },
  });

  assert.equal(persister.saveIfChanged(), false);
  assert.equal(persister.saveIfChanged(), false);
  assert.equal(messages.filter(([level]) => level === 'warn').length, 1);

  broken = false;
  assert.equal(persister.saveIfChanged(), true);
  assert.equal(messages.at(-1)[0], 'log');
});
