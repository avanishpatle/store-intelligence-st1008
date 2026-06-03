import { Event } from "../models/Event.js";

const EVENT_TYPES = new Set([
  "ENTRY",
  "EXIT",
  "ZONE_ENTER",
  "ZONE_EXIT",
  "ZONE_DWELL",
  "BILLING_QUEUE_JOIN",
  "BILLING_QUEUE_ABANDON",
  "REENTRY",
]);

export function validateEvent(raw) {
  const errors = [];
  if (!raw.event_id) errors.push("event_id required");
  if (!raw.store_id) errors.push("store_id required");
  if (!raw.visitor_id) errors.push("visitor_id required");
  if (!EVENT_TYPES.has(raw.event_type)) errors.push(`invalid event_type: ${raw.event_type}`);
  if (!raw.timestamp) errors.push("timestamp required");
  if (raw.confidence == null || raw.confidence < 0 || raw.confidence > 1) {
    errors.push("confidence must be 0-1");
  }
  return errors;
}

export async function ingestEvents(rawEvents) {
  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;
  const errors = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const raw = rawEvents[i];
    const valErrors = validateEvent(raw);
    if (valErrors.length) {
      rejected++;
      errors.push({ index: i, detail: valErrors });
      continue;
    }

    const existing = await Event.findOne({ event_id: raw.event_id });
    if (existing) {
      duplicates++;
      continue;
    }

    await Event.create({
      event_id: raw.event_id,
      store_id: raw.store_id,
      camera_id: raw.camera_id,
      visitor_id: raw.visitor_id,
      event_type: raw.event_type,
      timestamp: new Date(raw.timestamp.replace("Z", "")),
      zone_id: raw.zone_id ?? null,
      dwell_ms: raw.dwell_ms ?? 0,
      is_staff: Boolean(raw.is_staff),
      confidence: raw.confidence,
      metadata: raw.metadata || {},
    });
    accepted++;
  }

  return { accepted, rejected, duplicates, errors };
}
