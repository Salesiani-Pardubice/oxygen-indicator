export const FULL_OXYGEN = 100;
export const MIN_MINERS = 4;
export const MAX_MINERS = 6;
export const PRESET_KEYS = ['sleep', 'standard', 'work'];

// How long a full mask lasts for each preset, in seconds.
const DEFAULT_PRESET_SECONDS = { sleep: 240, standard: 120, work: 60 };

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
    if (state.paused || elapsedSeconds <= 0) return;

    for (const miner of state.miners) {
      miner.oxygen = Math.max(0, miner.oxygen - ratePerSecond(miner) * elapsedSeconds);
    }
  }

  function snapshot() {
    return {
      paused: state.paused,
      speed: state.speed,
      miners: state.miners.map((miner) => ({
        id: miner.id,
        name: miner.name,
        oxygen: roundOxygen(miner.oxygen),
        preset: miner.preset,
        rate: roundOxygen(ratePerSecond(miner)),
      })),
    };
  }

  return { tick, snapshot };
}
