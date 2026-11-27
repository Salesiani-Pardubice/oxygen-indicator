/** POSTs JSON and returns { status, data }; never throws on HTTP errors, only on network failure. */
export async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

/** A random id for this browser tab, used to identify the refill lock owner. */
export function getClientId() {
  const key = 'oxygen-client-id';
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
  } catch {
    // sessionStorage may be unavailable; fall through to a fresh id
  }
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    sessionStorage.setItem(key, id);
  } catch {
    // ignore
  }
  return id;
}
