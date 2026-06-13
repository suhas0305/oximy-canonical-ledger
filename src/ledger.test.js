import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "./cli.js";
import { currentState, ingestPayload, readLedger } from "./ledger.js";
import { computeMetrics } from "./metrics.js";
import { readJson } from "./util.js";
import { runQualityGates } from "./qualityGates.js";

test("seed creates canonical activities with late identity and cost claims applied", async () => {
  await seed();
  const state = await currentState();
  const metrics = computeMetrics(state.activities);
  assert.equal(metrics.activities, 11);
  assert.equal(metrics.active_users, 4);
  assert.equal(metrics.unresolved_activities, 0);
  assert.equal(metrics.total_cost_usd, 0.2089);
});

test("redelivery is physically idempotent", async () => {
  await seed();
  const before = await readLedger();
  const payload = await readJson("data/samples/chatgpt-web-v1.json");
  await ingestPayload(payload, "chatgpt-web-v1.json", "2026-06-13T00:00:00.000Z");
  const after = await readLedger();
  assert.equal(after.evidence.length, before.evidence.length);
  assert.equal(after.claims.length, before.claims.length);
});

test("production quality gates pass", async () => {
  const report = await runQualityGates();
  assert.equal(report.passed, true);
  assert.equal(report.metrics.activities, 11);
});
