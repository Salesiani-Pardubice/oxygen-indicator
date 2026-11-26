import { levelOf } from './levels.js';
import { formatDuration, PRESET_LABELS } from './format.js';

const gaugesEl = document.querySelector('#gauges');
const statusEl = document.querySelector('#status');
const bannerEl = document.querySelector('#banner');

/** miner id -> { card, name, fill, percent, remaining, mode } */
const gauges = new Map();

function createGauge() {
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

function render(snapshot) {
  gaugesEl.style.setProperty('--count', snapshot.miners.length);
  bannerEl.hidden = !snapshot.paused;

  const seen = new Set();
  for (const miner of snapshot.miners) {
    seen.add(miner.id);
    let gauge = gauges.get(miner.id);
    if (!gauge) {
      gauge = createGauge();
      gauges.set(miner.id, gauge);
      gaugesEl.append(gauge.card);
    }

    gauge.card.dataset.level = levelOf(miner.oxygen);
    gauge.name.textContent = miner.name;
    gauge.fill.style.height = `${miner.oxygen}%`;
    gauge.percent.textContent = `${Math.round(miner.oxygen)} %`;
    gauge.remaining.textContent = remainingText(miner, snapshot.paused);
    gauge.mode.textContent = PRESET_LABELS[miner.preset] ?? miner.preset;
  }

  for (const [id, gauge] of gauges) {
    if (!seen.has(id)) {
      gauge.card.remove();
      gauges.delete(id);
    }
  }
}

function setConnected(connected) {
  statusEl.hidden = connected;
}

const events = new EventSource('/api/events');
events.onopen = () => setConnected(true);
events.onerror = () => setConnected(false);
events.onmessage = (event) => {
  setConnected(true);
  render(JSON.parse(event.data));
};
