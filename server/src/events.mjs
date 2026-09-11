// In-process SSE hub + Postgres LISTEN/NOTIFY for multi-instance cluster fanout.
// In single-instance or non-DB mode, all operations stay in-process.
// When DATABASE_URL is active, events are published via pg_notify('mm_events')
// and received across all running replicas.
import crypto from "crypto";
import { getPool, query, dbEnabled } from "./db.mjs";

const NODE_ID = crypto.randomUUID();
const clients = new Map(); // userId -> Set<express Response>
const MAX_CONNECTIONS_PER_USER = 10; // bound each user's fan-out

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

function localPublishToUser(userId, event, data) {
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

/** Push one SSE event to every open connection of a user across all replicas. */
export function publishToUser(userId, event, data) {
  if (!userId) return;
  // 1. Deliver to local SSE clients on this process immediately
  localPublishToUser(userId, event, data);

  // 2. Broadcast to other nodes via Postgres NOTIFY if database is enabled
  if (dbEnabled) {
    try {
      const payload = JSON.stringify({ origin: NODE_ID, userId: String(userId), event, data });
      if (payload.length >= 7500) {
        // NOTIFY caps at 8000B; large frames deliver locally only. Log so
        // replica divergence is observable instead of silent.
        console.warn(JSON.stringify({ level: "warn", msg: "sse_notify_skipped_large", userId: String(userId), event, bytes: payload.length }));
      } else {
        query("SELECT pg_notify('mm_events', $1)", [payload]).catch((err) => {
          console.warn(JSON.stringify({ level: "warn", msg: "sse_notify_failed", error: String(err?.message || err) }));
        });
      }
    } catch {
      /* ignore serialization failure */
    }
  }
}

export function connectionCount() {
  let n = 0;
  for (const s of clients.values()) n += s.size;
  return n;
}

function localCloseUser(userId) {
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

/** Forcibly end every open stream of a user (e.g. on suspension) across all replicas. */
export function closeUser(userId) {
  if (!userId) return;
  localCloseUser(userId);

  if (dbEnabled) {
    try {
      const payload = JSON.stringify({ origin: NODE_ID, userId: String(userId) });
      query("SELECT pg_notify('mm_events_close', $1)", [payload]).catch(() => {});
    } catch {}
  }
}

let pubSubClient = null;
let reconnectTimer = null;

/** Initialize cross-node Postgres LISTEN client when running in DB mode */
export async function initEventsPubSub() {
  if (!dbEnabled) return;
  if (pubSubClient) return;

  try {
    const pool = getPool();
    const client = await pool.connect();
    pubSubClient = client;

    await client.query("LISTEN mm_events");
    await client.query("LISTEN mm_events_close");

    client.on("notification", (msg) => {
      try {
        if (msg.channel === "mm_events" && msg.payload) {
          const payload = JSON.parse(msg.payload);
          if (payload.origin !== NODE_ID && payload.userId) {
            localPublishToUser(payload.userId, payload.event, payload.data);
          }
        } else if (msg.channel === "mm_events_close" && msg.payload) {
          const payload = JSON.parse(msg.payload);
          if (payload.origin !== NODE_ID && payload.userId) {
            localCloseUser(payload.userId);
          }
        }
      } catch {
        /* malformed message — ignore */
      }
    });

    client.on("error", (err) => {
      console.warn(JSON.stringify({ level: "warn", msg: "pubsub_client_error", error: err.message }));
      try { client.release(); } catch {}
      pubSubClient = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          initEventsPubSub();
        }, 5000);
        if (reconnectTimer.unref) reconnectTimer.unref();
      }
    });
  } catch (err) {
    console.warn(JSON.stringify({ level: "warn", msg: "pubsub_init_failed", error: err.message }));
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initEventsPubSub();
      }, 5000);
      if (reconnectTimer.unref) reconnectTimer.unref();
    }
  }
}
