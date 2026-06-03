import { Event } from "../models/Event.js";
import {
  buildSessions,
  computeQueueDepth,
  fetchCustomerEvents,
  markConversions,
} from "./sessions.js";

export async function getMetrics(storeId, day) {
  const events = await fetchCustomerEvents(Event, storeId, day);
  const staffExcluded = await Event.countDocuments({
    store_id: storeId,
    is_staff: true,
  });

  const sessions = buildSessions(events);
  markConversions(sessions, storeId, day);

  const uniqueIds = new Set(
    sessions.filter((s) => s.entry_time).map((s) => s.visitor_id)
  );
  const convertedIds = new Set(sessions.filter((s) => s.converted).map((s) => s.visitor_id));
  const conversionRate = uniqueIds.size ? convertedIds.size / uniqueIds.size : 0;

  const zoneDwell = {};
  for (const ev of events) {
    if (ev.event_type === "ZONE_DWELL" && ev.zone_id) {
      if (!zoneDwell[ev.zone_id]) zoneDwell[ev.zone_id] = [];
      zoneDwell[ev.zone_id].push(ev.dwell_ms);
    }
  }
  const avgDwell = {};
  for (const [z, vals] of Object.entries(zoneDwell)) {
    avgDwell[z] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  const joins = events.filter((e) => e.event_type === "BILLING_QUEUE_JOIN").length;
  const abandons = events.filter((e) => e.event_type === "BILLING_QUEUE_ABANDON").length;

  return {
    store_id: storeId,
    date: day.toISOString().slice(0, 10),
    unique_visitors: uniqueIds.size,
    conversion_rate: Math.round(conversionRate * 10000) / 10000,
    avg_dwell_per_zone_ms: avgDwell,
    queue_depth: computeQueueDepth(events),
    abandonment_rate: joins ? Math.round((abandons / joins) * 10000) / 10000 : 0,
    staff_events_excluded: staffExcluded,
  };
}
