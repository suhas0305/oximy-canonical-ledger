import path from "node:path";
import { readdir } from "node:fs/promises";
import { DATA_DIR, readJson, stableHash } from "./util.js";

const SOURCE_MAP_DIR = path.join(DATA_DIR, "source-maps");

export async function loadSourceMaps() {
  try {
    const files = await readdir(SOURCE_MAP_DIR);
    return Promise.all(files.filter((file) => file.endsWith(".json")).map((file) => readJson(path.join(SOURCE_MAP_DIR, file))));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function configParserFor(payload) {
  const maps = await loadSourceMaps();
  const map = maps.find((candidate) => Object.entries(candidate.match ?? {}).every(([key, value]) => getPath(payload, key) === value));
  if (!map) return null;
  return (body, context) => parseWithMap(body, context, map);
}

export function parseWithMap(payload, context, map) {
  const stableParts = map.stable_id.fields.map((field) => getPath(payload, field));
  const stableActivityId = `act_${stableHash([map.source, ...stableParts]).slice(0, 20)}`;
  const model = getPath(payload, map.tool_ref.model_path);
  const activity = {
    claim_type: "activity_observed",
    stable_activity_id: stableActivityId,
    source_observation_id: context.evidenceId,
    source: map.source,
    source_activity_id: stableParts.join(":"),
    actor_ref: {
      kind: map.actor_ref.kind,
      value: getPath(payload, map.actor_ref.path) ?? null
    },
    tool_ref: {
      vendor: map.tool_ref.vendor,
      surface: map.tool_ref.surface,
      model: model ?? "unknown"
    },
    occurred_at: getPath(payload, map.occurred_at),
    observed_at: context.observedAt,
    activity_type: map.activity_type_path ? getPath(payload, map.activity_type_path) : map.activity_type,
    usage_measures: Object.fromEntries(Object.entries(map.usage_measures).map(([key, sourcePath]) => [key, getPath(payload, sourcePath) ?? 0])),
    content_refs: map.content_refs.map((ref) => ({ role: ref.role, preview: String(getPath(payload, ref.path) ?? "").slice(0, 160) })),
    completeness_state: getPath(payload, map.cost?.path) === undefined ? "cost_pending" : "complete",
    parser_version: map.parser_version,
    schema_fingerprint: context.schemaFingerprint
  };

  const claims = [activity];
  const cost = getPath(payload, map.cost?.path);
  if (cost !== undefined && cost !== null) {
    claims.push({
      claim_type: "cost_assigned",
      stable_activity_id: stableActivityId,
      amount_usd: Number(cost),
      authority: map.cost.authority,
      observed_at: context.observedAt,
      source_observation_id: context.evidenceId
    });
  }
  return claims;
}

export function getPath(value, expression) {
  if (!expression) return undefined;
  return expression.split(".").reduce((current, segment) => {
    if (current === undefined || current === null) return undefined;
    const match = segment.match(/^(.+)\[(\d+)\]$/);
    if (match) return current[match[1]]?.[Number(match[2])];
    return current[segment];
  }, value);
}
