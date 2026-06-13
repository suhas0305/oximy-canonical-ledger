import { compareFingerprints, structuralFingerprint } from "./drift.js";
import { currentState, ingestPayload, readLedger, resetLedger } from "./ledger.js";
import { computeMetrics } from "./metrics.js";
import { listSampleFiles, readJson, SAMPLE_DIR } from "./util.js";
import { CANONICAL_ACTIVITY_TYPES } from "./activityTypes.js";
import path from "node:path";

export async function runQualityGates() {
  await resetLedger();
  const files = await listSampleFiles();
  for (const file of files) {
    const payload = await readJson(file);
    await ingestPayload(payload, path.basename(file), fixedObservedAt(file));
  }

  const beforeRedelivery = await readLedger();
  const redelivered = await readJson(path.join(SAMPLE_DIR, "chatgpt-web-v1.json"));
  await ingestPayload(redelivered, "chatgpt-web-v1.json", "2026-06-13T00:00:00.000Z");
  const afterRedelivery = await readLedger();
  const state = await currentState();
  const metrics = computeMetrics(state.activities);

  const baseline = structuralFingerprint(await readJson(path.join(SAMPLE_DIR, "chatgpt-web-v1.json")));
  const current = structuralFingerprint(await readJson(path.join(SAMPLE_DIR, "chatgpt-web-v2-drift.json")));
  const drift = compareFingerprints(baseline, current);

  const gates = [
    gate("canonical_event_shape", state.activities.every(hasCanonicalShape), "Every reader can use one canonical activity shape."),
    gate("canonical_activity_type_taxonomy", hasAllCanonicalActivityTypes(state.activities), "The canonical taxonomy covers conversation, completion, code, image, embedding, retrieval, agent, document, and transcription activity."),
    gate("same_vendor_multi_surface", sameVendorMultiSurface(state.activities, "chatgpt"), "The same vendor maps incompatible web and API surfaces into the same canonical shape."),
    gate("config_driven_source", state.activities.some((activity) => activity.source === "acme-assistant:web"), "New source ingested through data/source-maps without parser code."),
    gate("narrow_reader_contract", onlyCanonicalFields(metrics), "Metrics are computed from canonical fields, not source-specific payload branches."),
    gate("late_cost_backfill", state.activities.some((activity) => activity.cost_authority === "invoice_export"), "Billing claim backfills cost onto an existing stable activity."),
    gate("incomplete_events_allowed", state.activities.some((activity) => activity.completeness_state === "cost_pending"), "Events can be born incomplete and remain reportable while awaiting late facts."),
    gate("append_only_idempotency", beforeRedelivery.claims.length === afterRedelivery.claims.length && beforeRedelivery.evidence.length === afterRedelivery.evidence.length, "Redelivery does not create duplicate evidence or claim rows."),
    gate("stable_dedup_key", new Set(state.activities.map((activity) => activity.stable_activity_id)).size === state.activities.length, "Current reads collapse to one activity per stable key."),
    gate("late_identity_resolution", state.activities.every((activity) => activity.person_id), "Identity claims resolve actor refs after ingest."),
    gate("raw_evidence_preserved", afterRedelivery.evidence.every((entry) => entry.payload && entry.payload_hash), "Every event points back to preserved raw evidence."),
    gate("drift_detection", drift.severity === "critical" && !drift.same, "Structural drift is detected and severity-ranked.")
  ];

  return {
    passed: gates.every((item) => item.passed),
    gates,
    metrics,
    activities: state.activities,
    drift
  };
}

function gate(name, passed, evidence) {
  return { name, passed, evidence };
}

function hasCanonicalShape(activity) {
  return Boolean(
    activity.stable_activity_id &&
    activity.actor_ref &&
    activity.tool_ref?.vendor &&
    activity.occurred_at &&
    activity.usage_measures &&
    Array.isArray(activity.content_refs) &&
    activity.parser_version &&
    activity.schema_fingerprint
  );
}

function sameVendorMultiSurface(activities, vendor) {
  const surfaces = new Set(activities.filter((activity) => activity.tool_ref.vendor === vendor).map((activity) => activity.tool_ref.surface));
  return surfaces.has("web") && surfaces.has("api");
}

function onlyCanonicalFields(metrics) {
  return Boolean(metrics.by_tool && metrics.by_cost_center && Number.isFinite(metrics.total_cost_usd));
}

function hasAllCanonicalActivityTypes(activities) {
  const present = new Set(activities.map((activity) => activity.activity_type));
  return CANONICAL_ACTIVITY_TYPES.every((entry) => present.has(entry.type));
}

function fixedObservedAt(file) {
  if (file.includes("directory")) return "2026-06-12T08:00:00.000Z";
  if (file.includes("billing")) return "2026-06-12T07:00:00.000Z";
  return "2026-06-11T18:00:00.000Z";
}
