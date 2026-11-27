import { formatDuration } from './format.js';
import { formatClock } from './log.js';

const $ = (selector) => document.querySelector(selector);

/** The expiry log card: newest first, rows updated in place (the "time at zero" keeps counting). */
export function createLogPanel({ command }) {
  const container = $('#log');
  const rows = new Map(); // entry id -> { row, name, zero }

  $('#clear-log').addEventListener('click', () => {
    if (confirm('Opravdu smazat log? Horníci, kterým kyslík právě došel, v něm zůstanou.')) command('clearLog');
  });

  function createRow(entry) {
    const row = document.createElement('div');
    row.className = 'log-row';
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = formatClock(entry.expiredAt);
    const name = document.createElement('span');
    name.className = 'log-name';
    const zero = document.createElement('span');
    zero.className = 'log-zero';
    row.append(time, name, zero);
    return { row, name, zero };
  }

  function render(log) {
    const seen = new Set();
    for (const entry of [...log].sort((a, b) => a.id - b.id)) {
      seen.add(entry.id);
      let item = rows.get(entry.id);
      if (!item) {
        item = createRow(entry);
        rows.set(entry.id, item);
        container.prepend(item.row); // ascending ids, so the newest ends up on top
      }
      const open = entry.recoveredAt === null;
      item.name.textContent = entry.minerName;
      item.zero.textContent = `${open ? 'stále na nule' : 'na nule'} ${formatDuration(entry.zeroSeconds)}`;
      item.row.dataset.open = String(open);
    }
    for (const [id, item] of rows) {
      if (!seen.has(id)) {
        item.row.remove();
        rows.delete(id);
      }
    }
    container.classList.toggle('empty', log.length === 0);
  }

  return { render };
}
