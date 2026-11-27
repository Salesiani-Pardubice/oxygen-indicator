import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createAuth, generatePin } from './auth.js';
import { loadEventDefs } from './events-config.js';
import { createGame } from './game.js';
import { createPersister } from './persistence.js';
import { createSseHub } from './sse.js';
import { createStore } from './store.js';
import { lanAddresses } from './network.js';

const PORT = Number(process.env.PORT) || 3000;
const TICK_MS = 250;
const SAVE_MS = 2000;
// Dev/testing switch: lets other devices than the server PC refill oxygen too.
const ALLOW_REMOTE_REFILL = process.env.ALLOW_REMOTE_REFILL === '1';
const STATE_FILE = process.env.STATE_FILE || fileURLToPath(new URL('../data/state.json', import.meta.url));

const ADMIN_PIN = process.env.ADMIN_PIN || generatePin();
const eventDefs = loadEventDefs();

// Pick up the previous game after a restart; a damaged save is set aside, not trusted.
const store = createStore(STATE_FILE);
let game;
try {
  const saved = store.load();
  game = createGame({ eventDefs, restore: saved });
  if (saved) console.log('Obnovena uložená hra (je pozastavená, spusťte ji v administraci).');
} catch (error) {
  console.warn(`Uloženou hru se nepodařilo načíst (${error.message}), začíná se znovu.`);
  store.quarantine();
  game = createGame({ eventDefs });
}

const persister = createPersister({ game, store });
persister.markLoaded();

const publicHub = createSseHub();
const adminHub = createSseHub();
const auth = createAuth({ pin: ADMIN_PIN });

setInterval(() => {
  game.tick();
  publicHub.broadcast(game.snapshot());
  adminHub.broadcast(game.adminSnapshot());
}, TICK_MS);

setInterval(() => persister.saveIfChanged(), SAVE_MS);

function shutdown() {
  game.tick();
  persister.saveIfChanged();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Listen on all interfaces so phones in the PC's hotspot can reach the server.
const app = createApp({ game, publicHub, adminHub, auth, allowRemoteRefill: ALLOW_REMOTE_REFILL });

app.listen(PORT, '0.0.0.0', () => {
  console.log('Kyslíkový indikátor běží.');
  console.log(`  Displej:  http://localhost:${PORT}/`);
  console.log(`  Admin:    http://localhost:${PORT}/admin   PIN: ${ADMIN_PIN}`);
  for (const address of lanAddresses()) {
    console.log(`  V síti:   http://${address}:${PORT}/  (admin: /admin)`);
  }
  console.log(`  Uložená hra: ${STATE_FILE}`);
});
