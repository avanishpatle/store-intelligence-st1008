import { Router } from "express";
import { isDbConnected } from "../db.js";
import { ingestEvents } from "../services/ingest.js";

const router = Router();

router.post("/ingest", async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({
      error: "database_unavailable",
      message: "Database is temporarily unavailable",
    });
  }

  const raw = Array.isArray(req.body) ? req.body : req.body?.events || [];
  req.eventCount = raw.length;

  if (raw.length > 500) {
    return res.status(400).json({
      error: "batch_too_large",
      message: "Maximum 500 events per batch",
    });
  }

  try {
    const result = await ingestEvents(raw);
    const code = result.rejected > 0 ? 207 : 200;
    return res.status(code).json(result);
  } catch {
    return res.status(503).json({
      error: "database_unavailable",
      message: "Failed to persist events",
    });
  }
});

export default router;
