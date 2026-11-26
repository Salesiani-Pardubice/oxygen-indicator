export const FULL_OXYGEN = 100;
export const MIN_MINERS = 4;
export const MAX_MINERS = 6;
export const PRESET_KEYS = ['sleep', 'standard', 'work'];

// How long a full mask lasts for each preset, in seconds.
const DEFAULT_PRESET_SECONDS = { sleep: 240, standard: 120, work: 60 };

const DEFAULT_REFILL_PER_CLICK = 1;
// The refill lock is released after this long without clicks.
export const REFILL_IDLE_MS = 10_000;
// Faster clicks are ignored, which stops auto-clickers (~12 clicks per second).
const MIN_CLICK_INTERVAL_MS = 80;

const roundOxygen = (value) => Math.round(value * 100) / 100;

/**
 * The authoritative game state. Time comes from an injectable monotonic clock
 * (milliseconds) so the whole thing can be tested without waiting.
 */
export function createGame({ clock = () => performance.now(), minerCount = MIN_MINERS } = {}) {
  let lastTick = clock();

  const state = {
    paused: false,
    speed: 1,
    presetSeconds: { ...DEFAULT_PRESET_SECONDS },
    refillPerClick: DEFAULT_REFILL_PER_CLICK,
    // Only one miner can be refilled at a time: { minerId, clientId, lastActivity, lastClick }.
    refill: null,
    miners: Array.from({ length: minerCount }, (_, index) => createMiner(index + 1)),
  };

  function createMiner(id) {
    return { id, name: `Horník ${id}`, oxygen: FULL_OXYGEN, preset: 'standard' };
  }

  /** Oxygen lost per second, in percent of a full mask. */
  function ratePerSecond(miner) {
    return (FULL_OXYGEN / state.presetSeconds[miner.preset]) * state.speed;
  }

  function tick() {
    const now = clock();
    const elapsedSeconds = (now - lastTick) / 1000;
    lastTick = now;

    if (state.refill && now - state.refill.lastActivity > REFILL_IDLE_MS) state.refill = null;
    if (state.paused || elapsedSeconds <= 0) return;

    for (const miner of state.miners) {
      miner.oxygen = Math.max(0, miner.oxygen - ratePerSecond(miner) * elapsedSeconds);
    }
  }

  /** Takes the refill lock for one miner. Fails while someone else holds it. */
  function startRefill(minerId, clientId) {
    const miner = state.miners.find((candidate) => candidate.id === minerId);
    if (!miner) return { ok: false, error: 'unknown-miner' };
    if (state.refill && state.refill.clientId !== clientId) return { ok: false, error: 'busy' };

    const now = clock();
    state.refill = { minerId, clientId, lastActivity: now, lastClick: -Infinity };
    return { ok: true, oxygen: roundOxygen(miner.oxygen) };
  }

  /** One mouse click: adds a fixed amount of oxygen to the miner being refilled. */
  function refillClick(clientId) {
    const lock = state.refill;
    if (!lock || lock.clientId !== clientId) return { ok: false, error: 'not-refilling' };

    const miner = state.miners.find((candidate) => candidate.id === lock.minerId);
    const now = clock();
    if (now - lock.lastClick < MIN_CLICK_INTERVAL_MS) {
      return { ok: true, applied: false, oxygen: roundOxygen(miner.oxygen), done: false };
    }

    lock.lastClick = now;
    lock.lastActivity = now;
    miner.oxygen = Math.min(FULL_OXYGEN, miner.oxygen + state.refillPerClick);

    const done = miner.oxygen >= FULL_OXYGEN;
    if (done) state.refill = null;
    return { ok: true, applied: true, oxygen: roundOxygen(miner.oxygen), done };
  }

  function stopRefill(clientId) {
    if (state.refill && state.refill.clientId === clientId) state.refill = null;
    return { ok: true };
  }

  function snapshot() {
    return {
      paused: state.paused,
      speed: state.speed,
      refill: state.refill ? { minerId: state.refill.minerId } : null,
      miners: state.miners.map((miner) => ({
        id: miner.id,
        name: miner.name,
        oxygen: roundOxygen(miner.oxygen),
        preset: miner.preset,
        rate: roundOxygen(ratePerSecond(miner)),
      })),
    };
  }

  return { tick, snapshot, startRefill, refillClick, stopRefill };
}
