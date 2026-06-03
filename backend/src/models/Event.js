import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    event_id: { type: String, required: true, unique: true },
    store_id: { type: String, required: true, index: true },
    camera_id: String,
    visitor_id: { type: String, index: true },
    event_type: { type: String, index: true },
    timestamp: { type: Date, required: true, index: true },
    zone_id: String,
    dwell_ms: { type: Number, default: 0 },
    is_staff: { type: Boolean, default: false },
    confidence: Number,
    metadata: {
      queue_depth: Number,
      sku_zone: String,
      session_seq: Number,
    },
  },
  { versionKey: false }
);

export const Event = mongoose.model("Event", eventSchema);
