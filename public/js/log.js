/** Entries of the expiry log that are newer than the last one the admin has seen. */
export function newExpiries(log, lastSeenId) {
  return log.filter((entry) => entry.id > lastSeenId);
}

export function latestLogId(log) {
  return log.reduce((max, entry) => Math.max(max, entry.id), 0);
}

const pad2 = (value) => String(value).padStart(2, '0');

/** Wall-clock time of day as HH:MM:SS. */
export function formatClock(epochMs) {
  const date = new Date(epochMs);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
