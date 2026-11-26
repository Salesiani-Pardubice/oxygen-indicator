function readMuted(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * Web Audio tone output. Browsers only allow sound after a user gesture, so nothing is
 * played until enable() has been called from one.
 */
export function createTonePlayer({ storageKey = 'oxygen-muted' } = {}) {
  let context = null;
  let muted = readMuted(storageKey);

  function enable() {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume();
  }

  function playTone(frequency, durationMs) {
    if (!context || muted || context.state !== 'running') return;

    const start = context.currentTime;
    const end = start + durationMs / 1000;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;

    // Short fades avoid clicks at the start and end of every tone.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
    gain.gain.setValueAtTime(0.15, Math.max(start + 0.01, end - 0.02));
    gain.gain.linearRampToValueAtTime(0, end);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end);
  }

  function setMuted(value) {
    muted = value;
    try {
      localStorage.setItem(storageKey, value ? '1' : '0');
    } catch {
      // the preference just won't survive a reload
    }
  }

  return {
    enable,
    playTone,
    setMuted,
    get enabled() {
      return context !== null;
    },
    get muted() {
      return muted;
    },
  };
}
