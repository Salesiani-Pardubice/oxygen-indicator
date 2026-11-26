import { networkInterfaces } from 'node:os';

/** Returns the external IPv4 addresses of this machine (e.g. the hotspot address). */
export function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);
}
