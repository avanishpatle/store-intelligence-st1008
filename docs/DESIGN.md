# Store Intelligence — MERN Architecture

## Overview

The system is built as a **MERN stack** application: **MongoDB** stores behavioural events, **Express** exposes the intelligence API, **React** provides a live dashboard, and **Node.js** runs the CCTV detection pipeline.

```
CCTV (CAM 1–5)
    → pipeline-node/detect.mjs (ffmpeg + motion)
    → data/events.jsonl
    → POST /events/ingest
    → MongoDB
    → Express metrics / funnel / heatmap / anomalies
    → React dashboard (polls every 2s)
```

## Backend (`backend/`)

- **Express** routers: `/events`, `/stores/:id/*`, `/health`
- **Mongoose** `Event` model with unique `event_id` for idempotent ingest
- **Session engine** (`services/sessions.js`) groups events into visits; funnel dedupes by `visitor_id`
- **POS correlation** reads `data/pos_transactions.csv` — billing activity within 5 minutes of transaction time
- **Structured logging** middleware: `trace_id`, `store_id`, `endpoint`, `latency_ms`, `event_count`, `status_code`
- **503** JSON when MongoDB is unavailable (no stack traces in responses)
- **STORE_BLR_002** alias resolves to `ST1008` for benchmark compatibility

## Frontend (`frontend/`)

- Vite + React single-page dashboard
- Polls `/stores/ST1008/metrics` and `/funnel` every 2 seconds
- Production build served by nginx with `/api` proxy to Express

## Pipeline (`pipeline-node/`)

- **ffmpeg-static** extracts sampled frames from each `.mp4`
- **sharp** grayscale + frame differencing for motion centroids (no Python dependency)
- Zone polygons from `store_layout.json`; CAM_1 entry line for ENTRY/EXIT
- Staff heuristic: track visible > ~150 sampled frames → `is_staff: true`

## AI-Assisted Decisions

1. **MERN vs Python FastAPI** — User requested MERN; AI noted Python is faster for CV-only prototypes. I **chose MERN** for full-stack interview alignment and React dashboard bonus, with Node motion pipeline instead of porting YOLO.

2. **MongoDB vs PostgreSQL** — AI suggested Postgres for analytics. I **chose MongoDB** for flexible event documents and natural fit with MERN `docker compose`.

3. **Motion detection vs TensorFlow.js** — AI suggested `@tensorflow-models/coco-ssd`. I **overrode** to ffmpeg + frame diff on Windows-friendly deps (no `canvas` native build issues in CI).

## Deployment

`docker compose up` starts **mongo**, **api** (port 8000), **frontend** (port 3000).
