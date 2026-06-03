import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const API = process.env.API_URL || "http://localhost:8000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(__dirname, "data", "sample_events.jsonl");

const events = fs
  .readFileSync(SAMPLE, "utf-8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

let r = await fetch(`${API}/events/ingest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ events }),
});
if (![200, 207].includes(r.status)) throw new Error(`ingest ${r.status}`);
const body = await r.json();
if (body.accepted < 1) throw new Error("no events accepted");

r = await fetch(`${API}/events/ingest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ events }),
});
if ((await r.json()).duplicates < 1) throw new Error("idempotency failed");

r = await fetch(`${API}/stores/ST1008/metrics?day=2026-04-10`);
const metrics = await r.json();
if (metrics.unique_visitors < 0) throw new Error("bad metrics");

r = await fetch(`${API}/stores/STORE_BLR_002/metrics?day=2026-04-10`);
if (r.status !== 200) throw new Error("alias failed");

r = await fetch(`${API}/health`);
if (r.status !== 200) throw new Error("health failed");

console.log("All assertions passed");
