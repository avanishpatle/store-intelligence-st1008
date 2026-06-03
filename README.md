# Store Intelligence — MERN Stack

**M**ongoDB · **E**xpress · **R**eact · **N**ode.js  

Brigade Bangalore (`ST1008`) — CCTV → events → analytics API → live dashboard.

## Stack

| Layer | Tech | Folder |
|-------|------|--------|
| API | Express + Mongoose | `backend/` |
| DB | MongoDB | Docker `mongo` |
| UI | React (Vite) | `frontend/` |
| Pipeline | Node + ffmpeg + motion detect | `pipeline-node/` |

## Quick start (Docker)

Requires **Docker Desktop** installed, running, and **WSL2** on Windows.

| Error | Fix |
|-------|-----|
| `command not found` | Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| `unable to start` / `docker_engine` | Install WSL: `wsl --install` → restart → open Docker Desktop → Settings → WSL integration |

If Docker cannot start yet, use [Run without Docker](#run-without-docker) temporarily.

```bash
cd "purple challenge 2"
docker compose up --build -d
```

## Run without Docker

You need **Node.js** + **MongoDB** (local install or free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster).

### 1. MongoDB

**Option A — Atlas (no install):** Create a free cluster → Connect → copy URI, then:

```bash
export MONGODB_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/store_intelligence"
```

**Option B — Local:** Install [MongoDB Community](https://www.mongodb.com/try/download/community), start service, then:

```bash
export MONGODB_URI="mongodb://127.0.0.1:27017/store_intelligence"
```

(Git Bash on Windows: use `export` as above. PowerShell: `$env:MONGODB_URI="mongodb://127.0.0.1:27017/store_intelligence"`)

### 2. API (terminal 1)

```bash
cd backend
npm install
npm run dev
```

### 3. Dashboard (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — API at http://localhost:8000

### 4. Smoke test

```bash
node assertions.mjs
```

- API: http://localhost:8000/health  
- Dashboard: http://localhost:3000  
- Metrics: http://localhost:8000/stores/ST1008/metrics?day=2026-04-10  

Ingest sample events:

```bash
node assertions.mjs
```

## Local dev (without Docker)

```bash
# Terminal 1 — MongoDB (or use Docker only for mongo)
docker run -d -p 27017:27017 mongo:7

# Terminal 2 — API
cd backend && npm install && npm run dev

# Terminal 3 — React dashboard
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 (Vite proxies `/api` → port 8000).

## Detection pipeline

```bash
cd pipeline-node
npm install
npm run detect:dev          # CAM_1, 100 frames
npm run detect              # all cameras (slow)
cd ..
node scripts/ingest_events.mjs
```

Output: `data/events.jsonl`

## API endpoints

| Method | Path |
|--------|------|
| POST | `/events/ingest` |
| GET | `/stores/{id}/metrics?day=YYYY-MM-DD` |
| GET | `/stores/{id}/funnel` |
| GET | `/stores/{id}/heatmap` |
| GET | `/stores/{id}/anomalies` |
| GET | `/health` |

`STORE_BLR_002` → alias for `ST1008`.

## Tests

```bash
cd backend && npm install && npm test
```

## Docs

- `docs/DESIGN.md`  
- `docs/CHOICES.md`  

## Data

- `data/store_layout.json`  
- `data/pos_transactions.csv`  
- `data/sample_events.jsonl`  
