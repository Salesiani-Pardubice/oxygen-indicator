import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { qrSvg } from '../public/js/qr.js';

// qrcode-generator 2.0.4, dist/qrcode.mjs from the npm tarball (see public/vendor/NOTICE.txt)
const VENDORED_SHA256 = 'ea91d7118a5395289170da848b7c6758b996163bfbccf312591ab65a4911b7c0';

test('the vendored QR library is the unmodified release', () => {
  const file = readFileSync(new URL('../public/vendor/qrcode.js', import.meta.url));
  assert.equal(createHash('sha256').update(file).digest('hex'), VENDORED_SHA256);
});

test('qrSvg returns an SVG with a white background', () => {
  const svg = qrSvg('http://192.168.0.153:3000/admin');
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /fill="white"/);
});

test('qrSvg is deterministic and depends on the text', () => {
  const url = 'http://192.168.0.153:3000/admin';
  assert.equal(qrSvg(url), qrSvg(url));
  assert.notEqual(qrSvg(url), qrSvg('http://192.168.0.154:3000/admin'));
});

test('longer texts get a larger code', () => {
  const size = (svg) => Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
  assert.ok(size(qrSvg('http://10.0.0.1/admin')) < size(qrSvg(`http://example.com/${'a'.repeat(120)}`)));
});
