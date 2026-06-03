import { randomUUID } from "crypto";

export function structuredLogging(req, res, next) {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  req.traceId = traceId;
  res.setHeader("X-Trace-Id", traceId);
  const start = Date.now();

  res.on("finish", () => {
    const log = {
      trace_id: traceId,
      store_id: req.params?.id || req.body?.store_id || "-",
      endpoint: req.path,
      latency_ms: Date.now() - start,
      event_count: req.eventCount ?? "-",
      status_code: res.statusCode,
    };
    console.log(JSON.stringify(log));
  });
  next();
}
