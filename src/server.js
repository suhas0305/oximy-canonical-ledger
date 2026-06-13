import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drift, replay, seed } from "./cli.js";
import { compareFingerprints, structuralFingerprint } from "./drift.js";
import { currentState, ingestPayload, readSchemaBaselines } from "./ledger.js";
import { computeMetrics, realityDiff } from "./metrics.js";
import { runQualityGates } from "./qualityGates.js";
import { CANONICAL_ACTIVITY_TYPES } from "./activityTypes.js";
import { readJson, SAMPLE_DIR } from "./util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const PORT = Number(process.env.PORT ?? 4317);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/state") return sendJson(res, await statePayload());
    if (url.pathname === "/api/activity-types") return sendJson(res, { types: CANONICAL_ACTIVITY_TYPES });
    if (url.pathname === "/api/seed" && req.method === "POST") {
      await seed();
      return sendJson(res, await statePayload());
    }
    if (url.pathname === "/api/replay" && req.method === "POST") {
      const before = computeMetrics((await currentState()).activities);
      await replay();
      const after = computeMetrics((await currentState()).activities);
      return sendJson(res, { before, after, diff: realityDiff(before, after) });
    }
    if (url.pathname === "/api/drift") return sendJson(res, await driftPayload());
    if (url.pathname === "/api/check") return sendJson(res, await runQualityGates());
    if (url.pathname === "/api/ingest-demo" && req.method === "POST") {
      const payload = await readBodyJson(req);
      const result = await ingestPayload(payload, "manual-demo", new Date().toISOString());
      return sendJson(res, { ingested: result.claims.length, state: await statePayload() });
    }
    return serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, { error: error.message, stack: error.stack }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Oximy canonical ledger running at http://localhost:${PORT}`);
});

async function statePayload() {
  const state = await currentState();
  const metrics = computeMetrics(state.activities);
  return { metrics, activities: state.activities };
}

async function driftPayload() {
  const baselines = await readSchemaBaselines();
  const baseline = baselines["chatgpt:web"] ?? structuralFingerprint(await readJson(path.join(SAMPLE_DIR, "chatgpt-web-v1.json")));
  const current = structuralFingerprint(await readJson(path.join(SAMPLE_DIR, "chatgpt-web-v2-drift.json")));
  return { baseline_hash: baseline.hash, current_hash: current.hash, report: compareFingerprints(baseline, current) };
}

async function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return sendText(res, "Forbidden", 403);
  try {
    const content = await readFile(filePath);
    const type = filePath.endsWith(".css") ? "text/css" : filePath.endsWith(".js") ? "text/javascript" : "text/html";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
    res.end(content);
  } catch {
    sendText(res, "Not found", 404);
  }
}

async function readBodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}
