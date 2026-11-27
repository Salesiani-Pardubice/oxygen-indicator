// Regenerates the screenshots in docs/screenshots/ used by the README.
//
//   npm run screenshots
//
// Starts the server with a prepared mid-game state, drives a headless Chrome through the
// Chrome DevTools Protocol and saves the pictures. Needs Node.js 22+ (global WebSocket) and
// Chrome/Chromium; set CHROME_PATH if it is not found automatically.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'docs', 'screenshots');
const PORT = 3190;
const PIN = '1234';
const BASE = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error('Chrome not found, set CHROME_PATH');
  return found;
}

/** A mid-game state in the format of data/state.json: five miners, two events, a small log. */
function preparedState() {
  const now = Date.now();
  const miner = (id, name, oxygen, preset) => ({ id, name, oxygen, preset });
  return {
    version: 1,
    speed: 1,
    presetSeconds: { sleep: 240, standard: 120, work: 60 },
    refillPerClick: 1,
    miners: [
      miner(1, 'Karel', 88, 'sleep'),
      miner(2, 'Jana', 64, 'standard'),
      miner(3, 'Tomáš', 41, 'work'),
      miner(4, 'Eliška', 14, 'standard'),
      miner(5, 'Matěj', 0, 'standard'),
    ],
    events: [
      { id: 1, defId: 'bomb', label: 'Prasklá bomba', multiplier: 2, targets: [3, 4], remainingMs: 42_000 },
      { id: 2, defId: 'collapse', label: 'Zával', multiplier: 1.5, targets: 'all', remainingMs: null },
    ],
    nextEventId: 3,
    log: [
      { id: 1, minerId: 3, minerName: 'Tomáš', expiredAt: now - 540_000, recoveredAt: now - 520_000 },
      { id: 2, minerId: 2, minerName: 'Jana', expiredAt: now - 250_000, recoveredAt: now - 220_000 },
      { id: 3, minerId: 5, minerName: 'Matěj', expiredAt: now - 75_000, recoveredAt: null },
    ],
    nextLogId: 4,
  };
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  throw new Error('server did not start');
}

async function connectToChrome(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  throw new Error('Chrome did not start');
}

function createBrowser(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const { result } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description);
    return result.result.value;
  };

  return {
    evaluate,
    async open(path, width, height, scale = 1) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: scale,
        mobile: width < 600,
      });
      await send('Page.navigate', { url: `${BASE}${path}` });
      await sleep(1500);
    },
    async click(selector) {
      const point = await evaluate(`(() => {
        const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
      }
    },
    /** Saves the part of the page from the top of `fromSelector` to the bottom of `toSelector`. */
    async shotRange(file, fromSelector = 'body', toSelector = fromSelector) {
      const clip = await evaluate(`(() => {
        const from = document.querySelector(${JSON.stringify(fromSelector)}).getBoundingClientRect();
        const to = document.querySelector(${JSON.stringify(toSelector)}).getBoundingClientRect();
        const top = from.top + scrollY;
        return { x: 0, y: top, width: innerWidth, height: to.bottom + scrollY - top + 8, scale: 1 };
      })()`);
      const { result } = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
      writeFileSync(join(OUT_DIR, file), Buffer.from(result.data, 'base64'));
      console.log(`  ${file}`);
    },
    close: () => socket.close(),
  };
}

async function main() {
  if (typeof WebSocket === 'undefined') throw new Error('Node.js 22 or newer is required');
  mkdirSync(OUT_DIR, { recursive: true });

  const workDir = mkdtempSync(join(tmpdir(), 'oxygen-shots-'));
  const stateFile = join(workDir, 'state.json');
  writeFileSync(stateFile, JSON.stringify(preparedState()));

  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), ADMIN_PIN: PIN, STATE_FILE: stateFile },
    stdio: 'ignore',
  });
  const debugPort = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${join(workDir, 'chrome')}`,
      '--no-first-run',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  try {
    await waitForServer();
    const socket = new WebSocket(await connectToChrome(debugPort));
    await new Promise((resolve) => (socket.onopen = resolve));
    const browser = createBrowser(socket);
    console.log(`Saving screenshots to ${OUT_DIR}`);

    // Log in as admin and start the game (the saved game comes back paused).
    await browser.open('/admin', 420, 900, 2);
    await browser.evaluate(`(async () => {
      const post = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await post('/api/admin/login', { pin: ${JSON.stringify(PIN)} });
      await post('/api/admin/command', { type: 'setPaused', paused: false });
    })()`);

    // Admin on a phone.
    await browser.open('/admin', 420, 900, 2);
    await sleep(1000);
    await browser.shotRange('admin-hra.png', '#panel > section:nth-of-type(2)', '#panel > section:nth-of-type(4)');
    await browser.shotRange('admin-hornici-log.png', '#panel > section:nth-of-type(5)', '#panel > section:nth-of-type(6)');

    // The display, then a refill in progress.
    await browser.open('/', 1280, 720);
    await sleep(1000);
    await browser.shotRange('displej.png');
    await browser.click('.gauge:nth-child(4)');
    await sleep(500);
    for (let i = 0; i < 6; i++) {
      await browser.click('#pump-button');
      await sleep(130);
    }
    await browser.shotRange('displej-doplnovani.png');
    browser.close();
  } finally {
    chrome.kill();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
