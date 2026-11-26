import { describeTargets, formatDuration, formatMultiplier } from './format.js';
import { createSegmented } from './ui.js';

const $ = (selector) => document.querySelector(selector);

const DURATIONS = [
  { value: 'default', label: 'Výchozí' },
  { value: 'custom', label: 'Vlastní' },
  { value: 'manual', label: 'Do ukončení' },
];

/**
 * The events card of the admin: launcher (event, duration, targets) and the list of running
 * events. `command(type, payload)` sends an admin command and resolves to true on success.
 */
export function createEventsPanel({ command }) {
  let defs = [];
  let miners = [];
  let selectedDef = null;
  let durationMode = 'default';
  const selectedTargets = new Set(); // empty = everybody

  let defPicker = null;
  let targetButtons = new Map(); // miner id (or 'all') -> button
  let builtForMiners = '';

  const durationPicker = createSegmented($('#event-duration'), DURATIONS, (value) => {
    durationMode = value;
    $('#event-custom').hidden = value !== 'custom';
    durationPicker.select(value);
  });
  durationPicker.select(durationMode);

  function describeDefault(def) {
    const time = def.durationSec === null ? 'do ručního ukončení' : `${def.durationSec} s`;
    return `${def.label}: spotřeba kyslíku ${formatMultiplier(def.multiplier)}, výchozí trvání ${time}.`;
  }

  function buildDefPicker() {
    $('#event-defs').replaceChildren();
    selectedDef = defs[0]?.id ?? null;
    defPicker = createSegmented(
      $('#event-defs'),
      defs.map((def) => ({ value: def.id, label: def.label })),
      (value) => {
        selectedDef = value;
        defPicker.select(value);
        $('#event-hint').textContent = describeDefault(defs.find((def) => def.id === value));
      },
    );
    defPicker.select(selectedDef);
    if (defs[0]) $('#event-hint').textContent = describeDefault(defs[0]);
  }

  function buildTargetButtons() {
    const container = $('#event-targets');
    container.replaceChildren();
    targetButtons = new Map();
    const make = (key, onClick) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', onClick);
      container.append(button);
      targetButtons.set(key, button);
    };
    make('all', () => {
      selectedTargets.clear();
      refreshTargets();
    });
    for (const miner of miners) {
      make(miner.id, () => {
        if (!selectedTargets.delete(miner.id)) selectedTargets.add(miner.id);
        refreshTargets();
      });
    }
  }

  function refreshTargets() {
    targetButtons.get('all').textContent = 'Všichni';
    targetButtons.get('all').setAttribute('aria-pressed', String(selectedTargets.size === 0));
    for (const miner of miners) {
      const button = targetButtons.get(miner.id);
      button.textContent = miner.name;
      button.setAttribute('aria-pressed', String(selectedTargets.has(miner.id)));
    }
  }

  $('#event-start').addEventListener('click', async () => {
    if (selectedDef === null) return;
    const payload = { eventId: selectedDef };
    if (durationMode === 'manual') payload.durationSec = null;
    if (durationMode === 'custom') payload.durationSec = $('#event-custom-seconds').valueAsNumber;
    payload.targets = selectedTargets.size === 0 ? 'all' : [...selectedTargets].sort((a, b) => a - b);
    await command('startEvent', payload);
  });

  // Running events are updated in place so a tap on "Ukončit" is never lost to a re-render.
  const rows = new Map(); // event id -> { row, text }

  function renderActive(events) {
    const container = $('#active-events');
    const seen = new Set();
    for (const event of events) {
      seen.add(event.id);
      let entry = rows.get(event.id);
      if (!entry) {
        const row = document.createElement('div');
        row.className = 'active-event';
        const text = document.createElement('span');
        const end = document.createElement('button');
        end.type = 'button';
        end.className = 'danger-outline';
        end.textContent = 'Ukončit';
        end.addEventListener('click', () => command('endEvent', { id: event.id }));
        row.append(text, end);
        container.append(row);
        entry = { row, text };
        rows.set(event.id, entry);
      }
      const time = event.remainingSec === null ? 'do ukončení' : formatDuration(event.remainingSec);
      entry.text.textContent = `${event.label} ${formatMultiplier(event.multiplier)} · ${time} · ${describeTargets(event.targets, miners)}`;
    }
    for (const [id, entry] of rows) {
      if (!seen.has(id)) {
        entry.row.remove();
        rows.delete(id);
      }
    }
    container.classList.toggle('empty', events.length === 0);
  }

  function render(snapshot) {
    miners = snapshot.miners;
    if (!defPicker || defs.length !== snapshot.eventDefs.length) {
      defs = snapshot.eventDefs;
      buildDefPicker();
    }

    const minerKey = miners.map((miner) => miner.id).join(',');
    if (minerKey !== builtForMiners) {
      builtForMiners = minerKey;
      for (const id of [...selectedTargets]) if (!miners.some((miner) => miner.id === id)) selectedTargets.delete(id);
      buildTargetButtons();
    }
    refreshTargets();
    renderActive(snapshot.events);
  }

  return { render };
}
