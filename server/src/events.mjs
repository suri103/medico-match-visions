// In-process SSE hub (audit: realtime chat). Single-instance by design — the
// documented deploy story. Multi-instance requires Redis pub/sub fanout.

const clients = new Map(); // userId -> Set<express Response>
const MAX_CONNECTIONS_PER_USER = 10; // audit M10: bound each user's fan-out



export function addClient(userId, res) {
  const key = String(userId);
  let set = clients.get(key);
  if (!set) {
    set = new Set();
    clients.set(key, set);
  } else if (set.size >= MAX_CONNECTIONS_PER_USER) {
    // Over a user's connection budget: drop the OLDEST stream so a reconnect
    // storm can never accumulate unbounded in-memory responses.
    const oldest = set.values().next().value;
    set.delete(oldest);
    try {
      oldest.end();
    } catch {
      /* already gone */
    }
  }
  set.add(res);
  return () => {
    const s = clients.get(key);
    if (!s) return;
    s.delete(res);
    if (s.size === 0) clients.delete(key);
  };
}

/** Push one SSE event to every open connection of a user. No-op if offline. */
export function publishToUser(userId, event, data) {
  if (!userId) return;
  const set = clients.get(String(userId));
  if (!set || set.size === 0) return;
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      // Audit M10: `write()` returning false means the kernel buffer is full
      // (client stalled). Treat that as backpressure and drop the dead stream
      // instead of buffering the event in memory forever.
      if (res.write(frame) === false) {
        set.delete(res);
        try {
          res.end();
        } catch {
          /* already gone */
        }
      }
    } catch {
      /* broken pipe — the close handler will deregister */
    }
  }
  if (set.size === 0) {
    clients.delete(String(userId));
  }
}

export function connectionCount() {
  let n = 0;
  for (const s of clients.values()) n += s.size;
  return n;
}

/** Forcibly end every open stream of a user (e.g. on suspension). */
export function closeUser(userId) {
  if (!userId) return;
  const key = String(userId);
  const s = clients.get(key);
  if (!s) return;
  for (const res of s) {
    try {
      res.end();
    } catch {
      /* already gone */
    }
  }
  clients.delete(key);
}
