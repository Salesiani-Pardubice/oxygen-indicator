/** Formats seconds as m:ss. */
export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export const PRESET_LABELS = {
  sleep: 'Spánek',
  standard: 'Normál',
  work: 'Práce',
};
