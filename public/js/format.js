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

/** "všichni" or the names of the targeted miners, for the event banners. */
export function describeTargets(targets, miners) {
  if (targets === 'all') return 'všichni';
  return miners
    .filter((miner) => targets.includes(miner.id))
    .map((miner) => miner.name)
    .join(', ');
}

/** "×2", "×0.5" */
export function formatMultiplier(multiplier) {
  return `×${Number(multiplier.toFixed(2))}`;
}
