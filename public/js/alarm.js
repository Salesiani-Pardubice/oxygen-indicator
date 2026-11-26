const BEEP_MS = 120;
const SIREN_STEP_MS = 350;
const SIREN_HIGH_RATIO = 1.25;

/**
 * Plays the alarm described by an alarmPattern() result. Tone output is injected
 * (`playTone(frequency, durationMs)`) so the scheduling can be tested without audio.
 */
export function createAlarm({ playTone }) {
  let pattern = { mode: 'off' };
  let timer = null;
  let high = false;

  function step() {
    timer = null;
    if (pattern.mode === 'beep') {
      playTone(pattern.frequency, BEEP_MS);
      timer = setTimeout(step, pattern.intervalMs);
    } else if (pattern.mode === 'siren') {
      high = !high;
      playTone(high ? pattern.frequency * SIREN_HIGH_RATIO : pattern.frequency, SIREN_STEP_MS);
      timer = setTimeout(step, SIREN_STEP_MS);
    }
  }

  /** Call on every state update; restarts the loop only when the mode changes. */
  function update(next) {
    const modeChanged = next.mode !== pattern.mode;
    pattern = next;
    if (next.mode === 'off') {
      clearTimeout(timer);
      timer = null;
    } else if (modeChanged || timer === null) {
      clearTimeout(timer);
      step();
    }
  }

  return { update };
}
