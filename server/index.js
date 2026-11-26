import { createApp } from './app.js';
import { createGame } from './game.js';
import { createSseHub } from './sse.js';
import { lanAddresses } from './network.js';

const PORT = Number(process.env.PORT) || 3000;
const TICK_MS = 250;
// Dev/testing switch: lets other devices than the server PC refill oxygen too.
const ALLOW_REMOTE_REFILL = process.env.ALLOW_REMOTE_REFILL === '1';

const game = createGame();
const publicHub = createSseHub();

setInterval(() => {
  game.tick();
  publicHub.broadcast(game.snapshot());
}, TICK_MS);

// Listen on all interfaces so phones in the PC's hotspot can reach the server.
createApp({ game, publicHub, allowRemoteRefill: ALLOW_REMOTE_REFILL }).listen(PORT, '0.0.0.0', () => {
  console.log('Kyslíkový indikátor běží.');
  console.log(`  Displej:  http://localhost:${PORT}/`);
  console.log(`  Admin:    http://localhost:${PORT}/admin`);
  for (const address of lanAddresses()) {
    console.log(`  V síti:   http://${address}:${PORT}/  (admin: /admin)`);
  }
});
