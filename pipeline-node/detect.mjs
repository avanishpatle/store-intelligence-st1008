import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const LAYOUT = JSON.parse(fs.readFileSync(path.join(DATA, "store_layout.json"), "utf-8"));
const CCTV_DIR =
  process.env.CCTV_DIR ||
  path.join(ROOT, "CCTV Footage-20260529T160731Z-3-00144614ea (1)", "CCTV Footage");
const OUTPUT = path.join(DATA, "events.jsonl");

const FRAME_SKIP = 15;
const DWELL_MS = 30000;

function parseArgs() {
  const args = process.argv.slice(2);
  let camera = null;
  let maxFrames = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--camera") camera = args[++i];
    if (args[i] === "--max-frames") maxFrames = Number(args[++i]);
  }
  return { camera, maxFrames };
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function zoneAt(nx, ny, polygons) {
  for (const [zid, poly] of Object.entries(polygons)) {
    if (pointInPolygon(nx, ny, poly)) return zid;
  }
  return null;
}

async function extractFramesBatch(videoPath, frameSkip, maxFrames) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "store-pipeline-"));
  const pattern = path.join(tmpDir, "frame_%05d.jpg");
  const vf = maxFrames
    ? `select='not(mod(n\\,${frameSkip}))',scale=320:180`
    : `select='not(mod(n\\,${frameSkip}))',scale=320:180`;
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    videoPath,
    "-vf",
    vf,
    "-vsync",
    "vfr",
  ];
  if (maxFrames) args.push("-frames:v", String(maxFrames));
  args.push("-q:v", "3", pattern);

  console.log(`  ffmpeg extracting frames (skip=${frameSkip}, max=${maxFrames ?? "all"})...`);

  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(err || `ffmpeg exit ${code}`));
      else resolve();
    });
    proc.on("error", reject);
  });

  const files = fs
    .readdirSync(tmpDir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(tmpDir, f));

  return { files, tmpDir };
}

function motionCentroids(prevGray, currGray, w, h, thresh = 25) {
  const blobs = [];
  const step = 8;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = y * w + x;
      if (Math.abs(currGray[i] - prevGray[i]) > thresh) {
        blobs.push({ cx: x + step / 2, cy: y + step / 2, conf: 0.75 });
      }
    }
  }
  const merged = [];
  for (const b of blobs) {
    const near = merged.find(
      (m) => Math.hypot(m.cx - b.cx, m.cy - b.cy) < 40
    );
    if (near) {
      near.cx = (near.cx + b.cx) / 2;
      near.cy = (near.cy + b.cy) / 2;
      near.conf = Math.max(near.conf, b.conf);
    } else merged.push({ ...b });
  }
  return merged.slice(0, 20);
}

class Tracker {
  constructor() {
    this.tracks = new Map();
    this.nextId = 1;
    this.visitorCounter = 0;
  }
  update(dets) {
    const used = new Set();
    for (const { cx, cy, conf } of dets) {
      let best = null;
      let bestD = 80;
      for (const [tid, tr] of this.tracks) {
        if (used.has(tid)) continue;
        const d = Math.hypot(tr.cx - cx, tr.cy - cy);
        if (d < bestD) {
          bestD = d;
          best = tid;
        }
      }
      if (best == null) {
        best = this.nextId++;
        this.visitorCounter++;
        this.tracks.set(best, {
          visitor_id: `VIS_${String(this.visitorCounter).padStart(6, "0")}`,
          cx,
          cy,
          conf,
          missed: 0,
          crossed_entry: false,
          crossed_exit: false,
          zones: new Set(),
          zoneEnterFrame: {},
          session_seq: 1,
          is_staff: false,
          frames: 0,
        });
      } else {
        const tr = this.tracks.get(best);
        tr.cx = cx;
        tr.cy = cy;
        tr.conf = conf;
        tr.missed = 0;
        tr.frames++;
        if (tr.frames > 150) tr.is_staff = true;
      }
      used.add(best);
    }
    for (const [tid, tr] of this.tracks) {
      if (!used.has(tid)) {
        tr.missed++;
        if (tr.missed > 30) this.tracks.delete(tid);
      }
    }
    return [...this.tracks.values()];
  }
}

function emitEvent(fields) {
  return {
    event_id: randomUUID(),
    store_id: LAYOUT.store_id,
    timestamp: fields.timestamp,
    camera_id: fields.camera_id,
    visitor_id: fields.visitor_id,
    event_type: fields.event_type,
    zone_id: fields.zone_id ?? null,
    dwell_ms: fields.dwell_ms ?? 0,
    is_staff: fields.is_staff ?? false,
    confidence: fields.confidence ?? 0.8,
    metadata: fields.metadata ?? { queue_depth: null, sku_zone: null, session_seq: 1 },
  };
}

async function processCamera(cam, maxFrames) {
  const videoPath = path.join(CCTV_DIR, cam.file);
  if (!fs.existsSync(videoPath)) {
    console.warn("Missing", videoPath);
    return [];
  }
  console.log(`\n[${cam.camera_id}] ${cam.file}`);

  const events = [];
  const clipStart = new Date(cam.clip_start_utc.replace("Z", ""));
  const polygons = LAYOUT.zone_polygons[cam.camera_id] || {};
  const entryCfg = LAYOUT.entry_line?.[cam.camera_id];
  const tracker = new Tracker();
  let prevGray = null;
  let w = 0,
    h = 0;
  const fps = 15;
  let queueDepth = 0;

  let tmpDir;
  let frameFiles;
  try {
    const batch = await extractFramesBatch(videoPath, FRAME_SKIP, maxFrames);
    tmpDir = batch.tmpDir;
    frameFiles = batch.files;
    console.log(`  ${frameFiles.length} frames to analyze`);
  } catch (e) {
    console.error(`  ffmpeg failed: ${e.message}`);
    return [];
  }

  let processed = 0;
  for (const filePath of frameFiles) {
    processed++;
    if (processed % 10 === 0 || processed === frameFiles.length) {
      process.stdout.write(`\r  progress: ${processed}/${frameFiles.length}`);
    }

    const frameIdx = (processed - 1) * FRAME_SKIP;
    const { data, info } = await sharp(filePath).grayscale().raw().toBuffer({ resolveWithObject: true });
    w = info.width;
    h = info.height;

    if (prevGray) {
      const dets = motionCentroids(prevGray, data, w, h);
      const tracks = tracker.update(dets);
      const ts = new Date(clipStart.getTime() + (frameIdx / fps) * 1000).toISOString();

      for (const tr of tracks) {
        const nx = tr.cx / w;
        const ny = tr.cy / h;

        if (entryCfg && cam.role === "entry") {
          const lineY = entryCfg.y_ratio;
          if (!tr.crossed_entry && ny > lineY) {
            tr.crossed_entry = true;
            events.push(
              emitEvent({
                camera_id: cam.camera_id,
                visitor_id: tr.visitor_id,
                event_type: "ENTRY",
                timestamp: ts,
                is_staff: tr.is_staff,
                confidence: tr.conf,
                metadata: { session_seq: tr.session_seq++ },
              })
            );
          } else if (tr.crossed_entry && !tr.crossed_exit && ny < lineY - 0.05) {
            tr.crossed_exit = true;
            events.push(
              emitEvent({
                camera_id: cam.camera_id,
                visitor_id: tr.visitor_id,
                event_type: "EXIT",
                timestamp: ts,
                is_staff: tr.is_staff,
                confidence: tr.conf,
              })
            );
          }
        }

        const zid = zoneAt(nx, ny, polygons);
        if (zid && !tr.zones.has(zid)) {
          tr.zones.add(zid);
          tr.zoneEnterFrame[zid] = frameIdx;
          events.push(
            emitEvent({
              camera_id: cam.camera_id,
              visitor_id: tr.visitor_id,
              event_type: "ZONE_ENTER",
              timestamp: ts,
              zone_id: zid,
              is_staff: tr.is_staff,
              confidence: tr.conf,
            })
          );
          if (zid === "BILLING" && queueDepth > 0) {
            events.push(
              emitEvent({
                camera_id: cam.camera_id,
                visitor_id: tr.visitor_id,
                event_type: "BILLING_QUEUE_JOIN",
                timestamp: ts,
                zone_id: "BILLING",
                is_staff: tr.is_staff,
                confidence: tr.conf,
                metadata: { queue_depth: queueDepth },
              })
            );
          } else if (zid === "BILLING") queueDepth++;
        }
      }
    }
    prevGray = data;
  }

  process.stdout.write("\n");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}

  console.log(`  ${cam.camera_id}: ${events.length} events from ${processed} frames`);
  return events;
}

async function main() {
  if (!ffmpegPath) {
    console.error("ffmpeg-static binary not found");
    process.exit(1);
  }
  console.log("CCTV dir:", CCTV_DIR);
  const { camera, maxFrames } = parseArgs();
  let all = [];
  for (const cam of LAYOUT.cameras) {
    if (camera && cam.camera_id !== camera) continue;
    all = all.concat(await processCamera(cam, maxFrames));
  }
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(OUTPUT, all.map((e) => JSON.stringify(e)).join("\n") + (all.length ? "\n" : ""));
  console.log(`Wrote ${all.length} events → ${OUTPUT}`);
}

main().catch(console.error);
