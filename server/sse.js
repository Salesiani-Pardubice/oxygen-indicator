/** Server-Sent Events hub: keeps open connections and pushes JSON payloads to all of them. */
export function createSseHub() {
  const clients = new Set();

  function connect(req, res, initialPayload) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 1000\n\n');
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  function broadcast(payload) {
    if (clients.size === 0) return;
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) res.write(message);
  }

  return {
    connect,
    broadcast,
    get size() {
      return clients.size;
    },
  };
}
