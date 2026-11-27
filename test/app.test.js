import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createGame } from '../server/game.js';
import { createSseHub } from '../server/sse.js';
import { createAuth } from '../server/auth.js';

const PIN = '4321';
let server;
let baseUrl;
let game;

const post = (path, body) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

before(async () => {
  game = createGame({
    startPaused: false,
    eventDefs: [{ id: 'bomb', label: 'Prasklá bomba', multiplier: 2, durationSec: 60 }],
  });
  server = createApp({
    game,
    publicHub: createSseHub(),
    adminHub: createSseHub(),
    auth: createAuth({ pin: PIN }),
    lanAddresses: () => ['192.168.0.10'],
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

test('health endpoint reports ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('serves the display page at / and the admin page at /admin', async () => {
  const display = await fetch(`${baseUrl}/`);
  assert.equal(display.status, 200);
  assert.match(await display.text(), /Kyslíkový indikátor/);

  const admin = await fetch(`${baseUrl}/admin`);
  assert.equal(admin.status, 200);
  assert.match(await admin.text(), /Administrace/);
});

test('serves static assets with the right content type', async () => {
  const res = await fetch(`${baseUrl}/css/style.css`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/css/);
});

test('returns 404 for unknown files', async () => {
  const res = await fetch(`${baseUrl}/nope.html`);
  assert.equal(res.status, 404);
});

test('does not serve files outside the public directory', async () => {
  const res = await fetch(`${baseUrl}/..%2Fpackage.json`);
  assert.notEqual(res.status, 200);
});

test('rejects non-GET methods', async () => {
  const res = await fetch(`${baseUrl}/api/health`, { method: 'POST' });
  assert.equal(res.status, 405);
});

test('streams the game snapshot over SSE', async () => {
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/api/events`, { signal: controller.signal });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);

  const reader = res.body.getReader();
  let text = '';
  while (!text.includes('data: ')) {
    const { value } = await reader.read();
    text += new TextDecoder().decode(value);
  }
  controller.abort();

  const snapshot = JSON.parse(text.split('data: ')[1]);
  assert.equal(snapshot.miners.length, 4);
  assert.equal(snapshot.paused, false);
});

test('the local PC may refill; clicks add oxygen and the lock blocks others', async () => {
  assert.deepEqual(await (await fetch(`${baseUrl}/api/session`)).json(), { canRefill: true });

  const start = await post('/api/refill/start', { minerId: 1, clientId: 'pc-1' });
  assert.equal(start.status, 200);

  const busy = await post('/api/refill/start', { minerId: 2, clientId: 'pc-2' });
  assert.equal(busy.status, 409);

  const click = await post('/api/refill/click', { clientId: 'pc-1' });
  assert.equal(click.status, 200);
  assert.equal((await click.json()).ok, true);

  const stop = await post('/api/refill/stop', { clientId: 'pc-1' });
  assert.equal(stop.status, 200);
});

test('refill requests are validated', async () => {
  assert.equal((await post('/api/refill/start', { minerId: 1 })).status, 400);
  assert.equal((await post('/api/refill/start', { minerId: 99, clientId: 'x' })).status, 404);
  assert.equal((await post('/api/refill/click', { clientId: 'nobody' })).status, 409);

  const broken = await fetch(`${baseUrl}/api/refill/click`, { method: 'POST', body: '{nope' });
  assert.equal(broken.status, 400);
});

async function adminLogin(pin = PIN) {
  const res = await post('/api/admin/login', { pin });
  return { res, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}

const adminPost = (cookie, body) =>
  fetch(`${baseUrl}/api/admin/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });

test('admin session reports whether the request is authenticated', async () => {
  assert.deepEqual(await (await fetch(`${baseUrl}/api/admin/session`)).json(), { authenticated: false });
  const { cookie } = await adminLogin();
  const session = await fetch(`${baseUrl}/api/admin/session`, { headers: { Cookie: cookie } });
  assert.deepEqual(await session.json(), { authenticated: true });
});

test('a wrong PIN is rejected', async () => {
  const { res, cookie } = await adminLogin('0000');
  assert.equal(res.status, 401);
  assert.equal(cookie, undefined);
});

test('admin endpoints require login', async () => {
  const command = await post('/api/admin/command', { type: 'setPaused', paused: true });
  assert.equal(command.status, 401);
  const events = await fetch(`${baseUrl}/api/admin/events`);
  assert.equal(events.status, 401);
});

test('an authenticated admin can run commands that change the game', async () => {
  const { cookie } = await adminLogin();
  assert.equal((await adminPost(cookie, { type: 'setPaused', paused: true })).status, 200);
  assert.equal(game.snapshot().paused, true);

  assert.equal((await adminPost(cookie, { type: 'renameMiner', id: 1, name: 'Karel' })).status, 200);
  assert.equal(game.snapshot().miners[0].name, 'Karel');

  const bad = await adminPost(cookie, { type: 'setSpeed', speed: 99 });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).message, /Rychlost/);

  assert.equal((await adminPost(cookie, { type: 'doesNotExist' })).status, 400);
  assert.equal((await adminPost(cookie, { type: 'constructor' })).status, 400);

  await adminPost(cookie, { type: 'setPaused', paused: false });
});

test('the admin stream sends the admin snapshot with settings', async () => {
  const { cookie } = await adminLogin();
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/api/admin/events`, {
    headers: { Cookie: cookie },
    signal: controller.signal,
  });
  const reader = res.body.getReader();
  let text = '';
  while (!text.includes('data: ')) text += new TextDecoder().decode((await reader.read()).value);
  controller.abort();

  const snapshot = JSON.parse(text.split('data: ')[1]);
  assert.equal(snapshot.settings.maxMiners, 6);
  assert.equal(snapshot.settings.presetSeconds.work, 60);
});

test('logout clears the cookie', async () => {
  const res = await post('/api/admin/logout', {});
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});

test('the admin can start and end events', async () => {
  const { cookie } = await adminLogin();

  const started = await adminPost(cookie, { type: 'startEvent', eventId: 'bomb', durationSec: null, targets: [1, 2] });
  assert.equal(started.status, 200);
  const { id } = await started.json();
  assert.equal(game.snapshot().events.length, 1);
  assert.equal(game.snapshot().events[0].remainingSec, null);
  assert.deepEqual(game.snapshot().events[0].targets, [1, 2]);

  assert.equal((await adminPost(cookie, { type: 'startEvent', eventId: 'unknown' })).status, 400);
  assert.equal((await adminPost(cookie, { type: 'endEvent', id: 12345 })).status, 404);
  assert.equal((await adminPost(cookie, { type: 'endEvent', id })).status, 200);
  assert.equal(game.snapshot().events.length, 0);

  // without durationSec the event's default applies
  await adminPost(cookie, { type: 'startEvent', eventId: 'bomb' });
  assert.equal(game.snapshot().events[0].remainingSec, 60);
  await adminPost(cookie, { type: 'resetGame' });
  await adminPost(cookie, { type: 'setPaused', paused: false });
});

test('the admin can clear the log', async () => {
  const { cookie } = await adminLogin();
  assert.equal((await adminPost(cookie, { type: 'clearLog' })).status, 200);
});

test('info lists the URLs where phones can reach the server', async () => {
  const info = await (await fetch(`${baseUrl}/api/info`)).json();
  const port = new URL(baseUrl).port;
  assert.deepEqual(info.adminUrls, [`http://192.168.0.10:${port}/admin`]);
  assert.deepEqual(info.displayUrls, [`http://192.168.0.10:${port}/`]);
});
