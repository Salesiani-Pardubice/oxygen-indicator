import { createApp } from './app.js';
import { lanAddresses } from './network.js';

const PORT = Number(process.env.PORT) || 3000;

// Listen on all interfaces so phones in the PC's hotspot can reach the server.
createApp().listen(PORT, '0.0.0.0', () => {
  console.log('Kyslíkový indikátor běží.');
  console.log(`  Displej:  http://localhost:${PORT}/`);
  console.log(`  Admin:    http://localhost:${PORT}/admin`);
  for (const address of lanAddresses()) {
    console.log(`  V síti:   http://${address}:${PORT}/  (admin: /admin)`);
  }
});
