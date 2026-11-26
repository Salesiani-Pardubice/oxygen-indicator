import { networkInterfaces } from 'node:os';

function ownAddresses() {
  return new Set(
    Object.values(networkInterfaces())
      .flat()
      .map((iface) => iface.address),
  );
}

/**
 * True when the request comes from the machine the server runs on, either via
 * localhost or via one of its own network addresses. Refilling is limited to this
 * PC so that players on phones in the hotspot cannot refill themselves.
 */
export function isLocalRequest(req, addresses = ownAddresses()) {
  const remote = req.socket.remoteAddress?.replace(/^::ffff:/, '');
  return remote !== undefined && addresses.has(remote);
}
