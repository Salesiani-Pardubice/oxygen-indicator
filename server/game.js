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

const SPEED_RANGE = { min: 0.25, max: 5 };
const PRESET_SECONDS_RANGE = { min: 10, max: 1800 };
const REFILL_PER_CLICK_RANGE = { min: 0.1, max: 10 };
const MAX_NAME_LENGTH = 20;

const roundOxygen = (value) => Math.round(value * 100) / 100;
const invalid = (message) => ({ ok: false, error: 'invalid', message });
const inRange = (value, { min, max }) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/**
 * The authoritative game state. Time comes from an injectable monotonic clock
 * (milliseconds) so the whole thing can be tested without waiting.
 */
export function createGame({
  clock = () => performance.now(),
  minerCount = MIN_MINERS,
  startPaused = true,
} = {}) {
  let lastTick = clock();

  const state = {
    paused: startPaused,
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

  function setPaused(paused) {
    if (typeof paused !== 'boolean') return invalid('Neplatný stav hry.');
    state.paused = paused;
    return { ok: true };
  }

  function setSpeed(speed) {
    if (!inRange(speed, SPEED_RANGE)) {
      return invalid(`Rychlost musí být mezi ${SPEED_RANGE.min} a ${SPEED_RANGE.max}.`);
    }
    state.speed = speed;
    return { ok: true };
  }

  /** Changes the number of miners; new miners start with a full mask, removed ones are the last. */
  function setMinerCount(count) {
    if (!Number.isInteger(count) || count < MIN_MINERS || count > MAX_MINERS) {
      return invalid(`Počet horníků musí být ${MIN_MINERS} až ${MAX_MINERS}.`);
    }
    while (state.miners.length < count) state.miners.push(createMiner(state.miners.length + 1));
    state.miners.length = count;
    if (state.refill && state.refill.minerId > count) state.refill = null;
    return { ok: true };
  }

  function renameMiner(id, name) {
    const miner = state.miners.find((candidate) => candidate.id === id);
    if (!miner) return { ok: false, error: 'unknown-miner' };
    if (typeof name !== 'string') return invalid('Neplatné jméno.');
    miner.name = name.trim().slice(0, MAX_NAME_LENGTH) || `Horník ${id}`;
    return { ok: true };
  }

  /** Sets the consumption preset of one miner, or of all of them with id "all". */
  function setPreset(id, preset) {
    if (!PRESET_KEYS.includes(preset)) return invalid('Neznámý režim spotřeby.');
    if (id === 'all') {
      for (const miner of state.miners) miner.preset = preset;
      return { ok: true };
    }
    const miner = state.miners.find((candidate) => candidate.id === id);
    if (!miner) return { ok: false, error: 'unknown-miner' };
    miner.preset = preset;
    return { ok: true };
  }

  function setPresetSeconds(preset, seconds) {
    if (!PRESET_KEYS.includes(preset)) return invalid('Neznámý režim spotřeby.');
    if (!inRange(seconds, PRESET_SECONDS_RANGE)) {
      return invalid(`Doba musí být mezi ${PRESET_SECONDS_RANGE.min} a ${PRESET_SECONDS_RANGE.max} s.`);
    }
    state.presetSeconds[preset] = seconds;
    return { ok: true };
  }

  function setRefillPerClick(value) {
    if (!inRange(value, REFILL_PER_CLICK_RANGE)) {
      return invalid(
        `Doplnění za kliknutí musí být mezi ${REFILL_PER_CLICK_RANGE.min} a ${REFILL_PER_CLICK_RANGE.max} %.`,
      );
    }
    state.refillPerClick = value;
    return { ok: true };
  }

  /** Starts over: everybody gets a full mask and the game waits paused for the admin. */
  function resetGame() {
    for (const miner of state.miners) miner.oxygen = FULL_OXYGEN;
    state.paused = true;
    state.refill = null;
    lastTick = clock();
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

  /** Everything the display gets, plus the settings only the admin needs. */
  function adminSnapshot() {
    return {
      ...snapshot(),
      settings: {
        presetSeconds: { ...state.presetSeconds },
        refillPerClick: state.refillPerClick,
        minMiners: MIN_MINERS,
        maxMiners: MAX_MINERS,
      },
    };
  }

  return {
    tick,
    snapshot,
    adminSnapshot,
    startRefill,
    refillClick,
    stopRefill,
    setPaused,
    setSpeed,
    setMinerCount,
    renameMiner,
    setPreset,
    setPresetSeconds,
    setRefillPerClick,
    resetGame,
  };
}
