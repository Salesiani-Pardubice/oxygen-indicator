import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLocalRequest } from '../server/local.js';

const own = new Set(['127.0.0.1', '::1', '192.168.0.10']);
const requestFrom = (remoteAddress) => ({ socket: { remoteAddress } });

test('recognizes loopback and own network addresses as local', () => {
  assert.equal(isLocalRequest(requestFrom('127.0.0.1'), own), true);
  assert.equal(isLocalRequest(requestFrom('::1'), own), true);
  assert.equal(isLocalRequest(requestFrom('::ffff:127.0.0.1'), own), true);
  assert.equal(isLocalRequest(requestFrom('192.168.0.10'), own), true);
});

test('treats other devices as remote', () => {
  assert.equal(isLocalRequest(requestFrom('192.168.0.57'), own), false);
  assert.equal(isLocalRequest(requestFrom(undefined), own), false);
});
