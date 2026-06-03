import { dayBounds, loadPosTransactions } from "../config.js";

const BILLING_WINDOW_MS = 5 * 60 * 1000;

export async function fetchCustomerEvents(Event, storeId, day) {
  const { start, end } = dayBounds(day);
  return Event.find({
    store_id: storeId,
    timestamp: { $gte: start, $lt: end },
    is_staff: false,
  })
    .sort({ timestamp: 1 })
    .lean();
}

export function buildSessions(events) {
  const sessions = [];
  const active = new Map();
  const exited = new Set();

  for (const ev of events) {
    const vid = ev.visitor_id;
    if (ev.event_type === "ENTRY") {
      if (exited.has(vid)) {
        sessions.push({
          visitor_id: vid,
          store_id: ev.store_id,
          reentry: true,
          entry_time: ev.timestamp,
          zones_visited: new Set(),
          billing_queue: false,
          converted: false,
        });
        exited.delete(vid);
      }
      active.set(vid, {
        visitor_id: vid,
        store_id: ev.store_id,
        reentry: false,
        entry_time: ev.timestamp,
        exit_time: null,
        zones_visited: new Set(),
        billing_queue: false,
        converted: false,
      });
    } else if (ev.event_type === "REENTRY") {
      active.set(vid, {
        visitor_id: vid,
        store_id: ev.store_id,
        reentry: true,
        entry_time: ev.timestamp,
        exit_time: null,
        zones_visited: new Set(),
        billing_queue: false,
        converted: false,
      });
    } else if (ev.event_type === "EXIT" && active.has(vid)) {
      const s = active.get(vid);
      s.exit_time = ev.timestamp;
      sessions.push(s);
      active.delete(vid);
      exited.add(vid);
    } else if (active.has(vid)) {
      const s = active.get(vid);
      if (["ZONE_ENTER", "ZONE_DWELL"].includes(ev.event_type) && ev.zone_id) {
        s.zones_visited.add(ev.zone_id);
      }
      if (ev.event_type === "BILLING_QUEUE_JOIN" || ev.zone_id === "BILLING") {
        s.billing_queue = true;
      }
    }
  }
  for (const s of active.values()) sessions.push(s);
  return sessions;
}

export function markConversions(sessions, storeId, day) {
  const pos = loadPosTransactions().filter((p) => p.store_id === storeId);
  const { start, end } = dayBounds(day);

  for (const sess of sessions) {
    if (!sess.billing_queue && !sess.zones_visited.has("BILLING")) continue;
    if (!sess.entry_time) continue;
    for (const txn of pos) {
      const ts = new Date(txn.timestamp.replace("Z", ""));
      if (ts < start || ts >= end) continue;
      const entry = new Date(sess.entry_time);
      if (entry <= ts) {
        const exitOk = !sess.exit_time || new Date(sess.exit_time) >= new Date(ts.getTime() - BILLING_WINDOW_MS);
        if (exitOk) {
          sess.converted = true;
          break;
        }
      }
    }
  }
}

export function computeQueueDepth(events) {
  let depth = 0;
  let maxDepth = 0;
  for (const ev of events) {
    if (ev.event_type === "BILLING_QUEUE_JOIN") {
      const q = ev.metadata?.queue_depth;
      depth = q != null ? Math.max(depth, q) : depth + 1;
      maxDepth = Math.max(maxDepth, depth);
    } else if (ev.event_type === "BILLING_QUEUE_ABANDON") {
      depth = Math.max(0, depth - 1);
    }
  }
  return maxDepth;
}
