import { Event } from "../models/Event.js";
import { isDbConnected } from "../db.js";

export async function getHealth() {
  if (!isDbConnected()) {
    return {
      status: "degraded",
      stores: {},
      warnings: ["DATABASE_UNAVAILABLE"],
    };
  }

  const storeIds = await Event.distinct("store_id");
  const ids = storeIds.length ? storeIds : ["ST1008"];
  const warnings = [];
  const stores = {};
  const now = Date.now();
  const staleMs = 10 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;

  for (const sid of ids) {
    const last = await Event.findOne({ store_id: sid }).sort({ timestamp: -1 }).lean();
    let lag_minutes = null;
    if (last) {
      const lag = now - new Date(last.timestamp).getTime();
      lag_minutes = Math.round(lag / 60000);
      if (lag > staleMs && lag < dayMs) {
        warnings.push(`STALE_FEED:${sid}`);
      }
    } else {
      warnings.push(`STALE_FEED:${sid}`);
    }
    stores[sid] = {
      last_event_timestamp: last ? new Date(last.timestamp).toISOString() : null,
      lag_minutes,
    };
  }

  const status = warnings.some((w) => w.startsWith("STALE_FEED")) ? "degraded" : "ok";
  return { status, stores, warnings };
}
