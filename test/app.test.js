import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createGame } from '../server/game.js';
import { createSseHub } from '../server/sse.js';

let server;
let baseUrl;

const post = (path, body) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

before(async () => {
  server = createApp({ game: createGame(), publicHub: createSseHub() });
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
