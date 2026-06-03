import { Router } from "express";
import { isDbConnected } from "../db.js";
import { parseDay, resolveStoreId } from "../config.js";
import { getMetrics } from "../services/metrics.js";
import { getFunnel } from "../services/funnel.js";
import { getHeatmap } from "../services/heatmap.js";
import { getAnomalies } from "../services/anomalies.js";

const router = Router();

function dbGuard(res) {
  if (!isDbConnected()) {
    res.status(503).json({
      error: "database_unavailable",
      message: "Database is temporarily unavailable",
    });
    return false;
  }
  return true;
}

router.get("/:id/metrics", async (req, res) => {
  if (!dbGuard(res)) return;
  const storeId = resolveStoreId(req.params.id);
  const day = parseDay(req.query.day);
  res.json(await getMetrics(storeId, day));
});

router.get("/:id/funnel", async (req, res) => {
  if (!dbGuard(res)) return;
  const storeId = resolveStoreId(req.params.id);
  const day = parseDay(req.query.day);
  res.json(await getFunnel(storeId, day));
});

router.get("/:id/heatmap", async (req, res) => {
  if (!dbGuard(res)) return;
  const storeId = resolveStoreId(req.params.id);
  const day = parseDay(req.query.day);
  res.json(await getHeatmap(storeId, day));
});

router.get("/:id/anomalies", async (req, res) => {
  if (!dbGuard(res)) return;
  const storeId = resolveStoreId(req.params.id);
  const day = parseDay(req.query.day);
  res.json(await getAnomalies(storeId, day));
});

export default router;
