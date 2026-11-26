import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EVENT_DURATION_RANGE = { min: 5, max: 3600 };

const DEFAULT_PATH = fileURLToPath(new URL('../config/events.json', import.meta.url));

/** Checks the event definitions and returns them normalized; throws with a readable message. */
export function validateEventDefs(defs) {
  if (!Array.isArray(defs)) throw new Error('events.json: expected an array of events');

  const seen = new Set();
  return defs.map((def, index) => {
    const where = `events.json: event #${index + 1}`;
    if (typeof def?.id !== 'string' || !def.id) throw new Error(`${where} needs a string "id"`);
    if (seen.has(def.id)) throw new Error(`${where}: duplicate id "${def.id}"`);
    seen.add(def.id);
    if (typeof def.label !== 'string' || !def.label) throw new Error(`${where} needs a "label"`);
    if (!(typeof def.multiplier === 'number' && def.multiplier > 0 && def.multiplier <= 10)) {
      throw new Error(`${where} ("${def.id}"): "multiplier" must be a number above 0 and at most 10`);
    }

    const duration = def.durationSec ?? null;
    const { min, max } = EVENT_DURATION_RANGE;
    if (duration !== null && !(typeof duration === 'number' && duration >= min && duration <= max)) {
      throw new Error(`${where} ("${def.id}"): "durationSec" must be null or between ${min} and ${max}`);
    }
    return { id: def.id, label: def.label, multiplier: def.multiplier, durationSec: duration };
  });
}

export function loadEventDefs(path = DEFAULT_PATH) {
  return validateEventDefs(JSON.parse(readFileSync(path, 'utf8')));
}
