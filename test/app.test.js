import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

let server;
let baseUrl;

before(async () => {
  server = createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

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
