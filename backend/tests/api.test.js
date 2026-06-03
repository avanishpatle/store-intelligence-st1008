// PROMPT: Jest + supertest tests for Express ingest idempotency, metrics, funnel, STORE_BLR_002 alias.
// CHANGES MADE: mongodb-memory-server setup; fixed funnel re-entry test expectations.

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import app from "../src/app.js";
import { Event } from "../src/models/Event.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(__dirname, "../../data/sample_events.jsonl");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Event.deleteMany({});
});

function loadSample() {
  return fs
    .readFileSync(SAMPLE, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

test("ingest and idempotent", async () => {
  const events = loadSample();
  const r1 = await request(app).post("/events/ingest").send({ events });
  expect([200, 207]).toContain(r1.status);
  expect(r1.body.accepted).toBeGreaterThan(0);
  const r2 = await request(app).post("/events/ingest").send({ events });
  expect(r2.body.duplicates).toBeGreaterThan(0);
});

test("partial malformed", async () => {
  const events = loadSample();
  const r = await request(app)
    .post("/events/ingest")
    .send({ events: [...events, { event_type: "BAD" }] });
  expect(r.status).toBe(207);
  expect(r.body.rejected).toBeGreaterThan(0);
});

test("metrics with events", async () => {
  await request(app).post("/events/ingest").send({ events: loadSample() });
  const r = await request(app).get("/stores/ST1008/metrics").query({ day: "2026-04-10" });
  expect(r.status).toBe(200);
  expect(r.body.unique_visitors).toBeGreaterThanOrEqual(1);
});

test("store alias STORE_BLR_002", async () => {
  await request(app).post("/events/ingest").send({ events: loadSample() });
  const r = await request(app).get("/stores/STORE_BLR_002/metrics").query({ day: "2026-04-10" });
  expect(r.status).toBe(200);
  expect(r.body.store_id).toBe("ST1008");
});

test("funnel four stages", async () => {
  await request(app).post("/events/ingest").send({ events: loadSample() });
  const r = await request(app).get("/stores/ST1008/funnel").query({ day: "2026-04-10" });
  expect(r.body.stages).toHaveLength(4);
});

test("health ok", async () => {
  const r = await request(app).get("/health");
  expect(r.status).toBe(200);
  expect(r.body).toHaveProperty("status");
});

test("empty store metrics", async () => {
  const r = await request(app).get("/stores/ST1008/metrics").query({ day: "2026-04-10" });
  expect(r.body.unique_visitors).toBe(0);
});

test("heatmap and anomalies", async () => {
  await request(app).post("/events/ingest").send({ events: loadSample() });
  const h = await request(app).get("/stores/ST1008/heatmap").query({ day: "2026-04-10" });
  expect(h.status).toBe(200);
  expect(h.body.data_confidence).toBeDefined();
  const a = await request(app).get("/stores/ST1008/anomalies").query({ day: "2026-04-10" });
  expect(a.status).toBe(200);
  expect(Array.isArray(a.body.anomalies)).toBe(true);
});
