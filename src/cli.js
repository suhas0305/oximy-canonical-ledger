import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareFingerprints, structuralFingerprint } from "./drift.js";
import { currentState, ingestPayload, readLedger, readSchemaBaselines, resetLedger, saveSchemaBaselines } from "./ledger.js";
import { computeMetrics, realityDiff } from "./metrics.js";
import { listSampleFiles, readJson, SAMPLE_DIR } from "./util.js";
import { runQualityGates } from "./qualityGates.js";

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const command = process.argv[2] ?? "help";
  if (command === "seed") {
    await seed();
  } else if (command === "replay") {
    await replay();
  } else if (command === "drift") {
    await drift();
  } else if (command === "check") {
    console.log(JSON.stringify(await runQualityGates(), null, 2));
  } else {
    console.log("Commands: npm run seed | npm run replay | npm run drift | npm run check | npm run serve | npm test");
  }
}

export async function seed() {
  await resetLedger();
  const files = await listSampleFiles();
  for (const file of files) {
    const payload = await readJson(file);
    await ingestPayload(payload, path.basename(file), fixedObservedAt(file));
  }
  const state = await currentState();
  console.log(JSON.stringify(computeMetrics(state.activities), null, 2));
}

export async function replay() {
  const beforeState = await currentState();
  const beforeMetrics = computeMetrics(beforeState.activities);
  await seed();
  const afterState = await currentState();
  const afterMetrics = computeMetrics(afterState.activities);
  console.log(JSON.stringify({ before: beforeMetrics, after: afterMetrics, diff: realityDiff(beforeMetrics, afterMetrics) }, null, 2));
}

export async function drift() {
  const baselinePayload = await readJson(path.join(SAMPLE_DIR, "chatgpt-web-v1.json"));
  const currentPayload = await readJson(path.join(SAMPLE_DIR, "chatgpt-web-v2-drift.json"));
  const baselines = await readSchemaBaselines();
  baselines["chatgpt:web"] = baselines["chatgpt:web"] ?? structuralFingerprint(baselinePayload);
  await saveSchemaBaselines(baselines);
  const report = compareFingerprints(baselines["chatgpt:web"], structuralFingerprint(currentPayload));
  console.log(JSON.stringify(report, null, 2));
}

function fixedObservedAt(file) {
  if (file.includes("directory")) return "2026-06-12T08:00:00.000Z";
  if (file.includes("billing")) return "2026-06-12T07:00:00.000Z";
  return "2026-06-11T18:00:00.000Z";
}
