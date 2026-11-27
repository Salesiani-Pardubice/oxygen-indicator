import { levelOf } from './levels.js';
import { PRESET_LABELS } from './format.js';
import { postJson } from './api.js';
import { createSegmented, createToast } from './ui.js';
import { createEventsPanel } from './admin-events.js';
import { createLogPanel } from './admin-log.js';
import { createAlerts } from './admin-alerts.js';
import { createTonePlayer } from './audio.js';
import { latestLogId, newExpiries } from './log.js';

const $ = (selector) => document.querySelector(selector);
const loginEl = $('#login');
const panelEl = $('#panel');
const statusEl = $('#status');
const logoutEl = $('#logout');
const showToast = createToast($('#toast'));

const SPEEDS = [0.5, 0.75, 1, 1.5, 2].map((value) => ({ value, label: `×${value}` }));
const PRESETS = Object.entries(PRESET_LABELS).map(([value, label]) => ({ value, label }));
const PRESET_KEYS = PRESETS.map((preset) => preset.value);

let snapshot = null;

async function command(type, payload = {}) {
  try {
    const { ok, status, data } = await postJson('/api/admin/command', { type, ...payload });
    if (ok) return true;
    if (status === 401) showLogin();
    else showToast(data.message ?? data.error ?? 'Příkaz se nepodařil.');
  } catch {
    showToast('Server neodpovídá.');
  }
  return false;
}

// --- login -------------------------------------------------------------------------------

function showLogin() {
  loginEl.hidden = false;
  panelEl.hidden = true;
  logoutEl.hidden = true;
  $('#pin').focus();
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorEl = $('#login-error');
  errorEl.hidden = true;
  try {
    const { ok, data } = await postJson('/api/admin/login', { pin: $('#pin').value });
    if (ok) {
      $('#pin').value = '';
      return startPanel();
    }
    errorEl.textContent = data.error ?? 'Přihlášení se nezdařilo.';
  } catch {
    errorEl.textContent = 'Server neodpovídá.';
  }
  errorEl.hidden = false;
});

logoutEl.addEventListener('click', async () => {
  await postJson('/api/admin/logout', {});
  location.reload();
});

const eventsPanel = createEventsPanel({ command });
const logPanel = createLogPanel({ command });
const alerts = createAlerts({ tones: createTonePlayer({ storageKey: 'oxygen-admin-muted' }) });
let lastSeenLogId = null; // set from the first snapshot, so old expiries don't trigger alerts

// --- game controls -----------------------------------------------------------------------

const speed = createSegmented($('#speed'), SPEEDS, (value) => command('setSpeed', { speed: value }));
let minerCount = null; // built on the first snapshot, once the allowed range is known
const allPresets = createSegmented($('#all-presets'), PRESETS, (value) =>
  command('setPreset', { id: 'all', preset: value }),
);

$('#toggle-pause').addEventListener('click', () => command('setPaused', { paused: !snapshot.paused }));
$('#reset').addEventListener('click', () => {
  if (confirm('Opravdu začít novou hru? Všem se doplní kyslík a hra se pozastaví.')) command('resetGame');
});

// --- miners ------------------------------------------------------------------------------

/** miner id -> { card, input, oxygen, fill, presets } */
const minerCards = new Map();

function createMinerCard(minerId) {
  const card = document.createElement('div');
  card.className = 'miner-card';
  card.innerHTML = `
    <div class="miner-top">
      <input class="miner-name" maxlength="20" aria-label="Jméno horníka" />
      <span class="miner-oxygen"></span>
    </div>
    <div class="miner-bar"><div class="miner-bar-fill"></div></div>
    <div class="segmented miner-presets"></div>
  `;
  const input = card.querySelector('.miner-name');
  input.addEventListener('change', () => command('renameMiner', { id: minerId, name: input.value }));
  input.addEventListener('keydown', (event) => event.key === 'Enter' && input.blur());

  const presets = createSegmented(card.querySelector('.miner-presets'), PRESETS, (value) =>
    command('setPreset', { id: minerId, preset: value }),
  );
  return {
    card,
    input,
    oxygen: card.querySelector('.miner-oxygen'),
    fill: card.querySelector('.miner-bar-fill'),
    presets,
  };
}

function renderMiners(miners) {
  const seen = new Set();
  for (const miner of miners) {
    seen.add(miner.id);
    let entry = minerCards.get(miner.id);
    if (!entry) {
      entry = createMinerCard(miner.id);
      minerCards.set(miner.id, entry);
      $('#miners').append(entry.card);
    }
    // Never overwrite a name while it is being typed.
    if (document.activeElement !== entry.input) entry.input.value = miner.name;
    entry.card.dataset.level = levelOf(miner.oxygen);
    entry.oxygen.textContent = `${Math.round(miner.oxygen)} %`;
    entry.fill.style.width = `${miner.oxygen}%`;
    entry.presets.select(miner.preset);
  }
  for (const [id, entry] of minerCards) {
    if (!seen.has(id)) {
      entry.card.remove();
      minerCards.delete(id);
    }
  }
}

// --- settings ----------------------------------------------------------------------------

const settingInputs = [
  ...PRESET_KEYS.map((key) => ({
    input: $(`#seconds-${key}`),
    read: (s) => s.presetSeconds[key],
    save: (value) => command('setPresetSeconds', { preset: key, seconds: value }),
  })),
  {
    input: $('#refill-per-click'),
    read: (s) => s.refillPerClick,
    save: (value) => command('setRefillPerClick', { value }),
  },
];

for (const setting of settingInputs) {
  setting.input.addEventListener('change', async () => {
    const saved = await setting.save(setting.input.valueAsNumber);
    if (!saved && snapshot) setting.input.value = setting.read(snapshot.settings);
  });
}

function renderSettings(settings) {
  for (const setting of settingInputs) {
    if (document.activeElement !== setting.input) setting.input.value = setting.read(settings);
  }
}

// --- rendering ---------------------------------------------------------------------------

function render(next) {
  snapshot = next;

  if (!minerCount) {
    const { minMiners, maxMiners } = next.settings;
    const options = [];
    for (let count = minMiners; count <= maxMiners; count++) {
      options.push({ value: count, label: String(count) });
    }
    minerCount = createSegmented($('#miner-count'), options, (value) => command('setMinerCount', { count: value }));
  }
  minerCount.select(next.miners.length);

  $('#toggle-pause').textContent = next.paused ? '▶ Spustit hru' : '⏸ Pozastavit hru';
  $('#game-state').textContent = next.paused ? 'Hra je pozastavená, kyslík se nespotřebovává.' : 'Hra běží.';
  speed.select(next.speed);
  allPresets.select(
    next.miners.every((miner) => miner.preset === next.miners[0].preset) ? next.miners[0].preset : null,
  );
  renderMiners(next.miners);
  renderSettings(next.settings);
  eventsPanel.render(next);
  logPanel.render(next.log);

  if (lastSeenLogId === null) {
    lastSeenLogId = latestLogId(next.log);
  } else {
    const fresh = newExpiries(next.log, lastSeenLogId);
    if (fresh.length > 0) {
      lastSeenLogId = latestLogId(next.log);
      alerts.notify(fresh);
    }
  }
}

// --- startup -----------------------------------------------------------------------------

function startPanel() {
  loginEl.hidden = true;
  panelEl.hidden = false;
  logoutEl.hidden = false;

  const events = new EventSource('/api/admin/events');
  events.onopen = () => (statusEl.hidden = true);
  events.onerror = () => (statusEl.hidden = false);
  events.onmessage = (event) => {
    statusEl.hidden = true;
    render(JSON.parse(event.data));
  };
}

async function init() {
  try {
    const { authenticated } = await (await fetch('/api/admin/session')).json();
    if (authenticated) return startPanel();
  } catch {
    showToast('Server neodpovídá.');
  }
  showLogin();
}

init();
