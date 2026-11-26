import { levelOf } from './levels.js';
import { formatDuration, PRESET_LABELS } from './format.js';
import { getClientId, postJson } from './api.js';
import { alarmPattern } from './alarm-pattern.js';
import { createAlarm } from './alarm.js';
import { createTonePlayer } from './audio.js';

const gaugesEl = document.querySelector('#gauges');
const statusEl = document.querySelector('#status');
const bannerEl = document.querySelector('#banner');
const hintEl = document.querySelector('#hint');
const toastEl = document.querySelector('#toast');
const pumpEl = document.querySelector('#pump');
const pumpNameEl = document.querySelector('#pump-name');
const pumpLevelEl = document.querySelector('#pump-level');
const pumpButton = document.querySelector('#pump-button');
const pumpDone = document.querySelector('#pump-done');
const soundButton = document.querySelector('#sound');

const clientId = getClientId();
const tones = createTonePlayer();
const alarm = createAlarm({ playTone: tones.playTone });
// Grace period after opening the pump panel, so a stale snapshot cannot close it right away.
const PUMP_OPEN_GRACE_MS = 1500;

/** miner id -> { card, name, fill, percent, remaining, mode } */
const gauges = new Map();
let lastSnapshot = null;
let canRefill = false;
let pump = null; // { minerId, openedAt } while this tab holds the refill lock
let clickSeq = 0;

function createGauge(minerId) {
  const card = document.createElement('article');
  card.className = 'gauge';
  card.innerHTML = `
    <h2 class="gauge-name"></h2>
    <div class="tank">
      <div class="tank-fill"></div>
      <div class="tank-percent"></div>
    </div>
    <div class="gauge-remaining"></div>
    <div class="gauge-mode"></div>
  `;
  card.addEventListener('click', () => startRefill(minerId));
  return {
    card,
    name: card.querySelector('.gauge-name'),
    fill: card.querySelector('.tank-fill'),
    percent: card.querySelector('.tank-percent'),
    remaining: card.querySelector('.gauge-remaining'),
    mode: card.querySelector('.gauge-mode'),
  };
}

function remainingText(miner, paused) {
  if (miner.oxygen <= 0) return 'Kyslík došel!';
  if (paused) return 'Pauza';
  return formatDuration(miner.oxygen / miner.rate);
}

let toastTimer;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 2500);
}

function render(snapshot) {
  lastSnapshot = snapshot;
  gaugesEl.style.setProperty('--count', snapshot.miners.length);
  bannerEl.hidden = !snapshot.paused;
  gaugesEl.classList.toggle('refillable', canRefill);

  const seen = new Set();
  for (const miner of snapshot.miners) {
    seen.add(miner.id);
    let gauge = gauges.get(miner.id);
    if (!gauge) {
      gauge = createGauge(miner.id);
      gauges.set(miner.id, gauge);
      gaugesEl.append(gauge.card);
    }

    gauge.card.dataset.level = levelOf(miner.oxygen);
    gauge.card.classList.toggle('refilling', snapshot.refill?.minerId === miner.id);
    gauge.name.textContent = miner.name;
    gauge.fill.style.height = `${miner.oxygen}%`;
    gauge.percent.textContent = `${Math.round(miner.oxygen)} %`;
    gauge.remaining.textContent =
      snapshot.refill?.minerId === miner.id ? 'Doplňuje se…' : remainingText(miner, snapshot.paused);
    gauge.mode.textContent = PRESET_LABELS[miner.preset] ?? miner.preset;
  }

  for (const [id, gauge] of gauges) {
    if (!seen.has(id)) {
      gauge.card.remove();
      gauges.delete(id);
    }
  }

  syncPump(snapshot);
  alarm.update(alarmPattern(snapshot.miners, snapshot.paused));
}

function syncPump(snapshot) {
  if (pump && !snapshot.refill && performance.now() - pump.openedAt > PUMP_OPEN_GRACE_MS) {
    closePump();
  }
  if (!pump) return;

  const miner = snapshot.miners.find((candidate) => candidate.id === pump.minerId);
  if (!miner) return closePump();
  pumpNameEl.textContent = miner.name;
  pumpLevelEl.textContent = `${Math.round(miner.oxygen)} %`;
}

function openPump(minerId) {
  pump = { minerId, openedAt: performance.now() };
  pumpEl.hidden = false;
  syncPump(lastSnapshot);
}

function closePump() {
  pump = null;
  pumpEl.hidden = true;
}

async function startRefill(minerId) {
  if (!canRefill || pump?.minerId === minerId) return;
  try {
    const { ok, status } = await postJson('/api/refill/start', { minerId, clientId });
    if (ok) return openPump(minerId);
    if (status === 409) showToast('Právě doplňuje kyslík někdo jiný.');
    else if (status === 403) showToast('Doplňovat lze jen z tohoto počítače.');
  } catch {
    showToast('Server neodpovídá.');
  }
}

async function click() {
  if (!pump) return;
  const seq = ++clickSeq;
  try {
    const { ok, data } = await postJson('/api/refill/click', { clientId });
    if (!ok) return closePump();
    if (seq === clickSeq && lastSnapshot) {
      // Show the new level right away instead of waiting for the next broadcast.
      const miner = lastSnapshot.miners.find((candidate) => candidate.id === pump?.minerId);
      if (miner) miner.oxygen = data.oxygen;
      render(lastSnapshot);
    }
    if (data.done) {
      closePump();
      showToast('Kyslík je plný!');
    }
  } catch {
    // a dropped click is harmless
  }
}

async function finishRefill() {
  closePump();
  try {
    await postJson('/api/refill/stop', { clientId });
  } catch {
    // the lock expires on its own
  }
}

// pointerdown (not click) so that holding Enter/Space on the button cannot auto-repeat.
pumpButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  click();
});
pumpDone.addEventListener('click', finishRefill);

function renderSoundButton() {
  soundButton.classList.toggle('attention', !tones.enabled);
  if (!tones.enabled) soundButton.textContent = '🔈 Zapnout zvuk';
  else soundButton.textContent = tones.muted ? '🔇 Zvuk ztlumen' : '🔊 Zvuk zapnut';
}

soundButton.addEventListener('click', () => {
  if (!tones.enabled) {
    tones.enable();
    tones.playTone(880, 200); // confirms that the speakers work
  } else {
    tones.setMuted(!tones.muted);
  }
  renderSoundButton();
});

// Any first click on the page also unlocks audio, in case nobody pressed the sound button.
document.addEventListener('pointerdown', (event) => {
  if (tones.enabled || event.target.closest('#sound')) return;
  tones.enable();
  renderSoundButton();
});
renderSoundButton();

function setConnected(connected) {
  statusEl.hidden = connected;
}

async function init() {
  try {
    canRefill = (await (await fetch('/api/session')).json()).canRefill;
  } catch {
    canRefill = false;
  }
  hintEl.hidden = !canRefill;
  if (lastSnapshot) render(lastSnapshot);

  const events = new EventSource('/api/events');
  events.onopen = () => setConnected(true);
  events.onerror = () => setConnected(false);
  events.onmessage = (event) => {
    setConnected(true);
    render(JSON.parse(event.data));
  };
}

init();
