export const LOW_THRESHOLD = 25;
export const CRITICAL_THRESHOLD = 10;

/** Classifies an oxygen percentage; used for colors on the display and for the alarm. */
export function levelOf(oxygen) {
  if (oxygen <= 0) return 'empty';
  if (oxygen < CRITICAL_THRESHOLD) return 'critical';
  if (oxygen < LOW_THRESHOLD) return 'low';
  return 'ok';
}
