import cors from "cors";
import express from "express";
import { structuredLogging } from "./middleware/logging.js";
import eventsRouter from "./routes/events.js";
import storesRouter from "./routes/stores.js";
import healthRouter from "./routes/health.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(structuredLogging);
app.use("/events", eventsRouter);
app.use("/stores", storesRouter);
app.use("/health", healthRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error", message: "An unexpected error occurred" });
});

export default app;
