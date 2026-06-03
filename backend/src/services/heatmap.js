import { Event } from "../models/Event.js";
import { buildSessions, fetchCustomerEvents } from "./sessions.js";

export async function getHeatmap(storeId, day) {
  const events = await fetchCustomerEvents(Event, storeId, day);
  const sessions = buildSessions(events);

  const zoneVisits = {};
  const zoneDwell = {};

  for (const ev of events) {
    if (ev.zone_id && ["ZONE_ENTER", "ZONE_DWELL"].includes(ev.event_type)) {
      zoneVisits[ev.zone_id] = (zoneVisits[ev.zone_id] || 0) + 1;
    }
    if (ev.event_type === "ZONE_DWELL" && ev.zone_id) {
      if (!zoneDwell[ev.zone_id]) zoneDwell[ev.zone_id] = [];
      zoneDwell[ev.zone_id].push(ev.dwell_ms);
    }
  }

  const maxVisits = Math.max(...Object.values(zoneVisits), 1);
  const dwellAvgs = Object.fromEntries(
    Object.entries(zoneDwell).map(([z, v]) => [z, v.reduce((a, b) => a + b, 0) / v.length])
  );
  const maxDwell = Math.max(...Object.values(dwellAvgs), 1);

  const allZones = new Set([...Object.keys(zoneVisits), ...Object.keys(zoneDwell)]);
  const zones = [...allZones].sort().map((zone_id) => ({
    zone_id,
    visit_frequency: Math.round((100 * (zoneVisits[zone_id] || 0)) / maxVisits),
    avg_dwell_score: Math.round((100 * (dwellAvgs[zone_id] || 0)) / maxDwell),
  }));

  return {
    store_id: storeId,
    date: day.toISOString().slice(0, 10),
    zones,
    data_confidence: sessions.length >= 20 ? "HIGH" : "LOW",
  };
}
