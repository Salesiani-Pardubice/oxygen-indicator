import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'oxygen_admin';
const SESSION_SECONDS = 3 * 24 * 60 * 60; // a weekend camp
const MAX_FAILURES = 5;
const LOCK_MS = 30_000;

export function generatePin() {
  return String(randomInt(0, 10_000)).padStart(4, '0');
}

function safeEqual(a, b) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name) cookies[name] = value.join('=');
  }
  return cookies;
}

/**
 * PIN protection for the admin. The session cookie is derived from the PIN, so it needs no
 * server-side storage and survives restarts as long as the PIN stays the same.
 */
export function createAuth({ pin, now = Date.now }) {
  const token = createHmac('sha256', pin).update('oxygen-indicator-admin').digest('hex');
  const attempts = new Map(); // client address -> { failures, lockedUntil }

  const cookie = (value, maxAge) =>
    `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;

  /** Checks a PIN. Too many wrong guesses from one address lock it out for a while. */
  function login(candidate, address) {
    const entry = attempts.get(address) ?? { failures: 0, lockedUntil: 0 };
    if (entry.lockedUntil > now()) {
      const retryAfterSec = Math.ceil((entry.lockedUntil - now()) / 1000);
      return { ok: false, error: 'locked', retryAfterSec };
    }

    if (safeEqual(candidate, pin)) {
      attempts.delete(address);
      return { ok: true, cookie: cookie(token, SESSION_SECONDS) };
    }

    entry.failures += 1;
    if (entry.failures >= MAX_FAILURES) {
      entry.failures = 0;
      entry.lockedUntil = now() + LOCK_MS;
    }
    attempts.set(address, entry);
    return { ok: false, error: 'wrong-pin' };
  }

  function isAuthorized(req) {
    const value = parseCookies(req.headers.cookie)[COOKIE_NAME];
    return typeof value === 'string' && safeEqual(value, token);
  }

  return { login, isAuthorized, logoutCookie: () => cookie('', 0) };
}
