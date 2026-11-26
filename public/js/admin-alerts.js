import { bindSoundToggle } from './ui.js';

const $ = (selector) => document.querySelector(selector);
const ALERT_TONES = [880, 660, 880, 660, 880];
const baseTitle = document.title;

/**
 * Phone alerts for the admin: when a miner runs out of oxygen the phone beeps, vibrates and shows
 * a banner. Sound needs a user gesture first; keeping the screen awake needs a secure context,
 * which the plain-HTTP hotspot address is not, so that part is best effort.
 */
export function createAlerts({ tones }) {
  const banner = $('#alert');
  let wakeLock = null;

  async function keepAwake() {
    try {
      wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      wakeLock = null; // unsupported, or refused: the phone just has to be kept awake by hand
    }
  }

  bindSoundToggle({
    button: $('#enable-alerts'),
    tones,
    labels: { off: '🔔 Zapnout upozornění', on: '🔔 Upozornění zapnutá', muted: '🔕 Upozornění ztlumená' },
    onEnable: keepAwake,
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && tones.enabled) keepAwake();
  });

  $('#alert-dismiss').addEventListener('click', () => {
    banner.hidden = true;
    document.title = baseTitle;
  });

  /** entries: the new expiry log entries. */
  function notify(entries) {
    $('#alert-text').textContent = `Došel kyslík: ${entries.map((entry) => entry.minerName).join(', ')}`;
    banner.hidden = false;
    document.title = `⚠ ${baseTitle}`;

    try {
      navigator.vibrate?.([400, 150, 400, 150, 400]);
    } catch {
      // vibration is a bonus
    }
    ALERT_TONES.forEach((frequency, index) => setTimeout(() => tones.playTone(frequency, 200), index * 260));
  }

  return { notify };
}
