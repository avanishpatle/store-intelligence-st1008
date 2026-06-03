import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EVENTS = path.join(ROOT, "data", "events.jsonl");
const API = process.argv[2] || "http://localhost:8000";

async function main() {
  if (!fs.existsSync(EVENTS)) {
    console.error("No events.jsonl — run: cd pipeline-node && npm run detect");
    process.exit(1);
  }
  const events = fs
    .readFileSync(EVENTS, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  for (let i = 0; i < events.length; i += 500) {
    const chunk = events.slice(i, i + 500);
    const r = await fetch(`${API}/events/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: chunk }),
    });
    console.log(i, r.status, await r.json());
  }

  const m = await fetch(`${API}/stores/ST1008/metrics?day=2026-04-10`);
  console.log("metrics", await m.json());
}

main();
