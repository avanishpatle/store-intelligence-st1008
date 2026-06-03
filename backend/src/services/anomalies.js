import { Event } from "../models/Event.js";
import { loadLayout } from "../config.js";
import { fetchCustomerEvents } from "./sessions.js";
import { getMetrics } from "./metrics.js";

export async function getAnomalies(storeId, day) {
  const events = await fetchCustomerEvents(Event, storeId, day);
  const anomalies = [];
  const refTime = events.length
    ? new Date(Math.max(...events.map((e) => new Date(e.timestamp).getTime())))
    : day;
  const recentCutoff = new Date(refTime.getTime() - 15 * 60 * 1000);

  const recentJoins = events.filter(
    (e) =>
      e.event_type === "BILLING_QUEUE_JOIN" && new Date(e.timestamp) >= recentCutoff
  ).length;

  if (recentJoins >= 3) {
    anomalies.push({
      type: "BILLING_QUEUE_SPIKE",
      severity: recentJoins >= 6 ? "CRITICAL" : "WARN",
      message: `Billing queue joins spiked to ${recentJoins} in 15 minutes`,
      suggested_action:
        "Open additional billing counter or redirect staff to billing zone",
    });
  }

  const metricsToday = await getMetrics(storeId, day);
  const histRates = [];
  for (let d = 1; d <= 7; d++) {
    const past = new Date(day);
    past.setUTCDate(past.getUTCDate() - d);
    const m = await getMetrics(storeId, past);
    if (m.unique_visitors > 0) histRates.push(m.conversion_rate);
  }
  if (histRates.length) {
    const avg = histRates.reduce((a, b) => a + b, 0) / histRates.length;
    if (avg > 0 && metricsToday.conversion_rate < avg * 0.7) {
      anomalies.push({
        type: "CONVERSION_DROP",
        severity: "WARN",
        message: `Conversion ${(metricsToday.conversion_rate * 100).toFixed(1)}% vs 7d avg ${(avg * 100).toFixed(1)}%`,
        suggested_action:
          "Review staffing, promotions, and queue wait times at billing",
      });
    }
  }

  const cutoff = new Date(refTime.getTime() - 30 * 60 * 1000);
  const recentZones = new Set(
    events
      .filter(
        (e) =>
          e.zone_id &&
          new Date(e.timestamp) >= cutoff &&
          ["ZONE_ENTER", "ZONE_DWELL"].includes(e.event_type)
      )
      .map((e) => e.zone_id)
  );

  for (const z of loadLayout().zones || []) {
    if (z.zone_id === "ENTRY") continue;
    if (!recentZones.has(z.zone_id)) {
      const last = await Event.findOne({ store_id: storeId, zone_id: z.zone_id })
        .sort({ timestamp: -1 })
        .lean();
      if (last) {
        anomalies.push({
          type: "DEAD_ZONE",
          severity: "INFO",
          message: `No visits in zone ${z.zone_id} for 30+ minutes`,
          suggested_action: `Check displays and staffing in ${z.zone_id}`,
        });
      }
    }
  }

  return { store_id: storeId, anomalies };
}
