import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
export const LAYOUT_PATH = path.join(DATA_DIR, "store_layout.json");
export const POS_PATH = path.join(DATA_DIR, "pos_transactions.csv");
export const CCTV_DIR =
  process.env.CCTV_DIR ||
  path.join(ROOT, "CCTV Footage-20260529T160731Z-3-00144614ea (1)", "CCTV Footage");

export const STORE_ALIASES = { STORE_BLR_002: "ST1008" };
export const PORT = Number(process.env.PORT || 8000);
export const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/store_intelligence";

export function resolveStoreId(storeId) {
  return STORE_ALIASES[storeId] || storeId;
}

let _layout;
export function loadLayout() {
  if (!_layout) {
    _layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, "utf-8"));
  }
  return _layout;
}

let _pos;
export function loadPosTransactions() {
  if (_pos) return _pos;
  if (!fs.existsSync(POS_PATH)) return [];
  const text = fs.readFileSync(POS_PATH, "utf-8");
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  _pos = lines.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      store_id: cols[0],
      transaction_id: cols[1],
      timestamp: cols[2],
      basket_value_inr: parseFloat(cols[3]),
    };
  });
  return _pos;
}

export function parseDay(dayStr) {
  if (dayStr) {
    const [y, m, d] = dayStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date();
}

export function dayBounds(day) {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
