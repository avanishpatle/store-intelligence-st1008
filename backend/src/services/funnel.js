import { Event } from "../models/Event.js";
import { buildSessions, fetchCustomerEvents, markConversions } from "./sessions.js";

export async function getFunnel(storeId, day) {
  const events = await fetchCustomerEvents(Event, storeId, day);
  const sessions = buildSessions(events);
  markConversions(sessions, storeId, day);

  const entryIds = new Set(sessions.filter((s) => s.entry_time).map((s) => s.visitor_id));
  const zoneIds = new Set(
    sessions.filter((s) => [...s.zones_visited].some((z) => z !== "ENTRY")).map((s) => s.visitor_id)
  );
  const billingIds = new Set(
    sessions
      .filter((s) => s.billing_queue || s.zones_visited.has("BILLING"))
      .map((s) => s.visitor_id)
  );
  const purchaseIds = new Set(sessions.filter((s) => s.converted).map((s) => s.visitor_id));

  const counts = [entryIds.size, zoneIds.size, billingIds.size, purchaseIds.size];
  const names = ["Entry", "Zone Visit", "Billing Queue", "Purchase"];
  const stages = names.map((name, i) => {
    const count = counts[i];
    let drop_off_pct = null;
    if (i > 0 && counts[i - 1] > 0) {
      drop_off_pct = Math.round((1 - count / counts[i - 1]) * 10000) / 100;
    }
    return { stage: name, count, drop_off_pct };
  });

  return { store_id: storeId, date: day.toISOString().slice(0, 10), stages };
}
