import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { send, sendJson } from './http-utils.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Friendly URLs mapped to the static files that serve them.
const PAGE_ALIASES = {
  '/': '/index.html',
  '/admin': '/admin.html',
};

async function serveStatic(pathname, req, res) {
  const requested = PAGE_ALIASES[pathname] ?? pathname;
  const filePath = normalize(join(PUBLIC_DIR, requested));

  // Never serve anything outside of the public directory.
  if (!filePath.startsWith(PUBLIC_DIR + sep)) {
    return send(res, 403, 'Forbidden');
  }

  try {
    const content = await readFile(filePath);
    const type = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    send(res, 404, 'Not found');
  }
}

export function createApp({ game, publicHub }) {
  // Dynamic endpoints, keyed by "METHOD /path".
  const routes = {
    'GET /api/health': (req, res) => sendJson(res, 200, { ok: true }),
    'GET /api/events': (req, res) => publicHub.connect(req, res, game.snapshot()),
  };

  return createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, 'Bad request');
    }

    const route = routes[`${req.method} ${pathname}`];
    if (route) return route(req, res);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method not allowed');
    }
    await serveStatic(pathname, req, res);
  });
}
