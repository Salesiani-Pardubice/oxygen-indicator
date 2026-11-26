import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, generatePin } from '../server/auth.js';

const requestWithCookie = (cookie) => ({ headers: { cookie } });
const cookieValue = (setCookie) => setCookie.split(';')[0];

test('a correct PIN returns a cookie that authorizes requests', () => {
  const auth = createAuth({ pin: '1234' });
  const result = auth.login('1234', 'phone');
  assert.equal(result.ok, true);
  assert.match(result.cookie, /HttpOnly/);
  assert.match(result.cookie, /SameSite=Strict/);
  assert.equal(auth.isAuthorized(requestWithCookie(cookieValue(result.cookie))), true);
});

test('requests without or with a wrong cookie are not authorized', () => {
  const auth = createAuth({ pin: '1234' });
  assert.equal(auth.isAuthorized({ headers: {} }), false);
  assert.equal(auth.isAuthorized(requestWithCookie('oxygen_admin=nope')), false);
  assert.equal(auth.isAuthorized(requestWithCookie('other=1; oxygen_admin=')), false);
});

test('the cookie stays valid across server restarts with the same PIN, not with another', () => {
  const cookie = cookieValue(createAuth({ pin: '1234' }).login('1234', 'a').cookie);
  assert.equal(createAuth({ pin: '1234' }).isAuthorized(requestWithCookie(cookie)), true);
  assert.equal(createAuth({ pin: '9999' }).isAuthorized(requestWithCookie(cookie)), false);
});

test('five wrong PINs lock the address out for 30 seconds', () => {
  let now = 1000;
  const auth = createAuth({ pin: '1234', now: () => now });
  for (let i = 0; i < 5; i++) assert.equal(auth.login('0000', 'kid').error, 'wrong-pin');

  const locked = auth.login('1234', 'kid'); // even the right PIN is refused while locked
  assert.equal(locked.error, 'locked');
  assert.equal(locked.retryAfterSec, 30);

  assert.equal(auth.login('1234', 'admin').ok, true); // other addresses are not affected

  now += 31_000;
  assert.equal(auth.login('1234', 'kid').ok, true);
});

test('generatePin returns four digits', () => {
  for (let i = 0; i < 50; i++) assert.match(generatePin(), /^\d{4}$/);
});
