const fail = (message) => {
  throw new Error(`saved state: ${message}`);
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isInt = (value) => Number.isInteger(value);
const inRange = (value, { min, max }) => isNumber(value) && value >= min && value <= max;

/**
 * Validates a game state read from disk and returns the parts of it that are restored.
 * Throws a descriptive Error on anything unexpected, so a damaged file never gets into the game.
 * `limits` carries the game's own rules (ranges, preset keys, miner count) so they live in one place.
 */
export function parseSavedState(data, limits) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) fail('not an object');
  if (data.version !== 1) fail(`unsupported version ${data.version}`);

  if (!inRange(data.speed, limits.speed)) fail('invalid speed');
  if (!inRange(data.refillPerClick, limits.refillPerClick)) fail('invalid refillPerClick');

  const presetSeconds = {};
  for (const key of limits.presetKeys) {
    if (!inRange(data.presetSeconds?.[key], limits.presetSeconds)) fail(`invalid presetSeconds.${key}`);
    presetSeconds[key] = data.presetSeconds[key];
  }

  const { miners } = data;
  if (!Array.isArray(miners) || miners.length < limits.minMiners || miners.length > limits.maxMiners) {
    fail('invalid number of miners');
  }
  const savedMiners = miners.map((miner, index) => {
    if (miner?.id !== index + 1) fail(`miner #${index + 1} has a wrong id`);
    if (typeof miner.name !== 'string' || miner.name.length > limits.maxNameLength) fail('invalid miner name');
    if (!inRange(miner.oxygen, { min: 0, max: limits.fullOxygen })) fail('invalid miner oxygen');
    if (!limits.presetKeys.includes(miner.preset)) fail('invalid miner preset');
    return { id: miner.id, name: miner.name, oxygen: miner.oxygen, preset: miner.preset };
  });

  if (!Array.isArray(data.events)) fail('events is not an array');
  const events = data.events.map((event) => {
    const validTargets =
      event?.targets === 'all' ||
      (Array.isArray(event?.targets) && event.targets.every((id) => isInt(id) && id >= 1 && id <= miners.length));
    if (!isInt(event?.id) || typeof event.defId !== 'string' || typeof event.label !== 'string') {
      fail('invalid event');
    }
    if (!(isNumber(event.multiplier) && event.multiplier > 0 && event.multiplier <= 10)) fail('invalid event multiplier');
    if (!validTargets) fail('invalid event targets');
    if (event.remainingMs !== null && !(isNumber(event.remainingMs) && event.remainingMs > 0)) {
      fail('invalid event remainingMs');
    }
    return {
      id: event.id,
      defId: event.defId,
      label: event.label,
      multiplier: event.multiplier,
      targets: event.targets === 'all' ? 'all' : [...event.targets],
      remainingMs: event.remainingMs,
    };
  });
  if (!isInt(data.nextEventId) || events.some((event) => event.id >= data.nextEventId)) fail('invalid nextEventId');

  if (!Array.isArray(data.log)) fail('log is not an array');
  const log = data.log.map((entry) => {
    const valid =
      isInt(entry?.id) &&
      isInt(entry.minerId) &&
      typeof entry.minerName === 'string' &&
      isNumber(entry.expiredAt) &&
      (entry.recoveredAt === null || isNumber(entry.recoveredAt));
    if (!valid) fail('invalid log entry');
    return {
      id: entry.id,
      minerId: entry.minerId,
      minerName: entry.minerName,
      expiredAt: entry.expiredAt,
      recoveredAt: entry.recoveredAt,
    };
  });
  if (!isInt(data.nextLogId) || log.some((entry) => entry.id >= data.nextLogId)) fail('invalid nextLogId');

  return {
    speed: data.speed,
    refillPerClick: data.refillPerClick,
    presetSeconds,
    miners: savedMiners,
    events,
    nextEventId: data.nextEventId,
    log,
    nextLogId: data.nextLogId,
  };
}
