import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, readJson, send, sendJson } from './http-utils.js';
import { adminCommands } from './admin-commands.js';
import { isLocalRequest } from './local.js';

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

// Maps the error codes returned by game commands to HTTP statuses.
const ERROR_STATUS = {
  invalid: 400,
  busy: 409,
  'not-refilling': 409,
  'unknown-miner': 404,
};

export function createApp({ game, publicHub, adminHub, auth, allowRemoteRefill = false }) {
  const canRefill = (req) => allowRemoteRefill || isLocalRequest(req);
  const publish = () => {
    publicHub.broadcast(game.snapshot());
    adminHub.broadcast(game.adminSnapshot());
  };

  function requireAdmin(req) {
    if (!auth.isAuthorized(req)) throw new HttpError(401, 'Přihlas se prosím PINem.');
  }

  function respond(res, result) {
    if (result.ok) {
      publish();
      return sendJson(res, 200, result);
    }
    sendJson(res, ERROR_STATUS[result.error] ?? 400, result);
  }

  async function refillBody(req) {
    if (!canRefill(req)) throw new HttpError(403, 'Doplňovat lze jen z počítače, na kterém běží server');
    const body = await readJson(req);
    if (typeof body.clientId !== 'string' || !body.clientId || body.clientId.length > 64) {
      throw new HttpError(400, 'Missing clientId');
    }
    return body;
  }

  // Dynamic endpoints, keyed by "METHOD /path".
  const routes = {
    'GET /api/health': (req, res) => sendJson(res, 200, { ok: true }),
    'GET /api/events': (req, res) => publicHub.connect(req, res, game.snapshot()),
    'GET /api/session': (req, res) => sendJson(res, 200, { canRefill: canRefill(req) }),
    'POST /api/refill/start': async (req, res) => {
      const body = await refillBody(req);
      respond(res, game.startRefill(body.minerId, body.clientId));
    },
    'POST /api/refill/click': async (req, res) => {
      const body = await refillBody(req);
      respond(res, game.refillClick(body.clientId));
    },
    'POST /api/refill/stop': async (req, res) => {
      const body = await refillBody(req);
      respond(res, game.stopRefill(body.clientId));
    },

    'GET /api/admin/session': (req, res) => sendJson(res, 200, { authenticated: auth.isAuthorized(req) }),
    'POST /api/admin/login': async (req, res) => {
      const body = await readJson(req);
      const result = auth.login(String(body.pin ?? ''), req.socket.remoteAddress);
      if (result.ok) return sendJson(res, 200, { ok: true }, { 'Set-Cookie': result.cookie });
      if (result.error === 'locked') {
        const message = `Příliš mnoho pokusů, zkus to za ${result.retryAfterSec} s.`;
        return sendJson(res, 429, { error: message });
      }
      sendJson(res, 401, { error: 'Špatný PIN.' });
    },
    'POST /api/admin/logout': (req, res) =>
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.logoutCookie() }),
    'GET /api/admin/events': (req, res) => {
      requireAdmin(req);
      adminHub.connect(req, res, game.adminSnapshot());
    },
    'POST /api/admin/command': async (req, res) => {
      requireAdmin(req);
      const body = await readJson(req);
      const command = Object.hasOwn(adminCommands, body.type) ? adminCommands[body.type] : null;
      if (!command) throw new HttpError(400, 'Neznámý příkaz.');
      respond(res, command(game, body));
    },
  };

  return createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, 'Bad request');
    }

    const route = routes[`${req.method} ${pathname}`];
    if (route) {
      try {
        return await route(req, res);
      } catch (error) {
        if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message });
        console.error(error);
        return sendJson(res, 500, { error: 'Internal error' });
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method not allowed');
    }
    await serveStatic(pathname, req, res);
  });
}
