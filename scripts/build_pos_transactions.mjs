import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "Brigade_Bangalore_10_April_26 (1)bc6219c.csv");
const OUT = path.join(ROOT, "data", "pos_transactions.csv");

function parseTs(dateStr, timeStr) {
  const [d, m, y] = dateStr.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${timeStr}Z`;
}

const orders = new Map();
for (const line of fs.readFileSync(SRC, "utf-8").trim().split("\n").slice(1)) {
  const cols = line.split(",");
  const oid = cols[0];
  if (!orders.has(oid)) {
    orders.set(oid, { store_id: cols[9], date: cols[6], time: cols[7], basket: 0 });
  }
  orders.get(oid).basket += parseFloat(cols[cols.length - 4] || 0);
}

const rows = [["store_id", "transaction_id", "timestamp", "basket_value_inr"]];
for (const [oid, d] of [...orders.entries()].sort((a, b) => parseTs(a[1].date, a[1].time).localeCompare(parseTs(b[1].date, b[1].time)))) {
  rows.push([d.store_id, `TXN_${oid}`, parseTs(d.date, d.time), d.basket.toFixed(2)]);
}
fs.writeFileSync(OUT, rows.map((r) => r.join(",")).join("\n") + "\n");
console.log(`Wrote ${orders.size} transactions to ${OUT}`);
