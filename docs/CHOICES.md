# Engineering Choices (MERN)

This document explains three core decisions for the Purplle Brigade Bangalore Store Intelligence project (`ST1008`), including what AI tools suggested and what I chose in the end.

---

## 1. Detection model: ffmpeg motion pipeline (Node) instead of YOLO

**Options considered**

| Option | Pros | Cons |
|--------|------|------|
| YOLOv8 + ByteTrack (Python) | Best person detection, industry standard | Separate language from MERN API; heavy GPU deps |
| TensorFlow.js COCO-SSD | Person class in Node | Native `canvas` build issues on Windows; slow on CPU |
| ffmpeg + frame differencing | Pure Node; works on all 5 CCTV clips | Weaker on occlusion; motion ≠ person always |

**What AI suggested:** Start with YOLOv8 for accuracy, or `@tensorflow-models/coco-ssd` if staying in JavaScript.

**What I chose:** `pipeline-node/detect.mjs` using **ffmpeg-static** (batch frame extract) + **sharp** grayscale diff + centroid tracking. Zones and ENTRY/EXIT come from `data/store_layout.json` polygons and CAM_1 threshold line.

**Why:** Keeps the entire stack in Node for MERN consistency. On Brigade footage we generated **150 events** across 5 cameras. Staff is flagged when a track persists ~150 sampled frames (`is_staff: true`). Low-confidence motion is still emitted — never silently dropped — per schema rules.

**Trade-off I accept:** Group entry and re-entry are harder without Re-ID embeddings. I would move to YOLO + ByteTrack if production accuracy became the bottleneck.

---

## 2. Event schema: challenge catalogue unchanged

**Options considered**

- Minimal custom schema (timestamp + zone only)
- Full challenge schema with `metadata.queue_depth`, `session_seq`, `sku_zone`

**What AI suggested:** Keep the provided schema verbatim so `/funnel`, `/heatmap`, and POS correlation stay aligned.

**What I chose:** Exact event types (`ENTRY`, `EXIT`, `ZONE_*`, `BILLING_QUEUE_*`, `REENTRY`) with `sku_zone` mapped from `store_layout.json`.

**Why:** North-star **conversion rate** needs billing-zone timestamps correlated with `pos_transactions.csv` (5-minute window before each txn). Extra metadata costs little and powers queue depth and heatmap dwell scores. Our run on **2026-04-10** yielded **19 unique visitors** and **26.3% conversion** — funnel stages (Entry 19 → Purchase 5) match `/metrics`.

---

## 3. API architecture: Express + MongoDB + batch ingest

**Options considered**

- Kafka / Redis streams between pipeline and API
- PostgreSQL + materialised views
- MongoDB documents + compute-on-read sessions

**What AI suggested:** Event bus for “40 live stores.”

**What I chose:** **MongoDB** with `POST /events/ingest` (≤500 events, idempotent by `event_id`), session logic in `backend/src/services/sessions.js`, metrics computed on read.

**Why:** One `docker compose up` starts mongo + api + frontend — meets acceptance gate. Event documents map 1:1 to JSONL pipeline output. Funnel dedupes by `visitor_id` so re-entry does not double-count. `STORE_BLR_002` aliases to **ST1008** for benchmark endpoints.

**What breaks first at scale:** Mongo write throughput and lack of pre-aggregated rollups; I would add Redis counters or a nightly batch job before changing the external API contract.

---

## Store-specific note

Dataset uses real Purplle POS (`Brigade_Bangalore_10_April_26.csv` → 24 transactions) and 5 CCTV angles, not the fictional `STORE_BLR_002` ZIP. Store layout zones were defined from the Brigade floor plan XLSX plus camera role assumptions (CAM_1 entry, CAM_4/5 billing).
