import { createApp } from './app.js';
import { createAuth, generatePin } from './auth.js';
import { loadEventDefs } from './events-config.js';
import { createGame } from './game.js';
import { createSseHub } from './sse.js';
import { lanAddresses } from './network.js';

const PORT = Number(process.env.PORT) || 3000;
const TICK_MS = 250;
// Dev/testing switch: lets other devices than the server PC refill oxygen too.
const ALLOW_REMOTE_REFILL = process.env.ALLOW_REMOTE_REFILL === '1';

const ADMIN_PIN = process.env.ADMIN_PIN || generatePin();

const game = createGame({ eventDefs: loadEventDefs() });
const publicHub = createSseHub();
const adminHub = createSseHub();
const auth = createAuth({ pin: ADMIN_PIN });

setInterval(() => {
  game.tick();
  publicHub.broadcast(game.snapshot());
  adminHub.broadcast(game.adminSnapshot());
}, TICK_MS);

// Listen on all interfaces so phones in the PC's hotspot can reach the server.
const app = createApp({ game, publicHub, adminHub, auth, allowRemoteRefill: ALLOW_REMOTE_REFILL });

app.listen(PORT, '0.0.0.0', () => {
  console.log('Kyslíkový indikátor běží.');
  console.log(`  Displej:  http://localhost:${PORT}/`);
  console.log(`  Admin:    http://localhost:${PORT}/admin   PIN: ${ADMIN_PIN}`);
  for (const address of lanAddresses()) {
    console.log(`  V síti:   http://${address}:${PORT}/  (admin: /admin)`);
  }
});
