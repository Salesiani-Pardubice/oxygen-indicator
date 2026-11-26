import { LOW_THRESHOLD } from './levels.js';

const SLOWEST_BEEP_MS = 1200; // just below the low threshold
const FASTEST_BEEP_MS = 250; // almost out of oxygen
const BASE_FREQUENCY = 600;
const FREQUENCY_STEP = 80;

/**
 * Decides what the alarm should sound like. One alarm covers all miners and follows the
 * most endangered one: a siren once someone is out of oxygen, otherwise beeps that speed up
 * as oxygen drops below the low threshold. The pitch differs per miner so they can be told apart.
 */
export function alarmPattern(miners, paused) {
  if (paused || miners.length === 0) return { mode: 'off' };

  let worstIndex = 0;
  miners.forEach((miner, index) => {
    if (miner.oxygen < miners[worstIndex].oxygen) worstIndex = index;
  });
  const worst = miners[worstIndex];
  const frequency = BASE_FREQUENCY + FREQUENCY_STEP * worstIndex;

  if (worst.oxygen <= 0) return { mode: 'siren', frequency };
  if (worst.oxygen >= LOW_THRESHOLD) return { mode: 'off' };

  const ratio = worst.oxygen / LOW_THRESHOLD;
  const intervalMs = Math.round(FASTEST_BEEP_MS + ratio * (SLOWEST_BEEP_MS - FASTEST_BEEP_MS));
  return { mode: 'beep', frequency, intervalMs };
}
