import { stableHash } from "../util.js";

export function parseCursor(payload, context) {
  const stableActivityId = `act_${stableHash(["cursor", payload.eventId]).slice(0, 20)}`;
  return [
    {
      claim_type: "activity_observed",
      stable_activity_id: stableActivityId,
      source_observation_id: context.evidenceId,
      source: "cursor:cli",
      source_activity_id: payload.eventId,
      actor_ref: { kind: "handle", value: payload.actor?.handle ?? null },
      tool_ref: { vendor: "cursor", surface: "cli", model: payload.model ?? "unknown" },
      workspace_ref: payload.workspace,
      occurred_at: payload.started,
      observed_at: context.observedAt,
      activity_type: "code_assist",
      usage_measures: {
        input_tokens: payload.tokens?.prompt ?? 0,
        output_tokens: payload.tokens?.completion ?? 0,
        duration_seconds: secondsBetween(payload.started, payload.ended)
      },
      content_refs: [{ role: "prompt", preview: (payload.prompt ?? "").slice(0, 160) }],
      completeness_state: "cost_pending",
      parser_version: "cursor-cli@1",
      schema_fingerprint: context.schemaFingerprint
    }
  ];
}

function secondsBetween(start, end) {
  const delta = Date.parse(end) - Date.parse(start);
  return Number.isFinite(delta) ? Math.max(0, Math.round(delta / 1000)) : 0;
}
