import { Router } from "express";
import { getHealth } from "../services/health.js";

const router = Router();

router.get("/", async (_req, res) => {
  res.json(await getHealth());
});

export default router;
