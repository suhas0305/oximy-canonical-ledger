import path from "node:path";
import { appendUniqueJsonl, clearFile, ensureDirs, LEDGER_DIR, readJsonl, stableHash, writeJson } from "./util.js";
import { structuralFingerprint } from "./drift.js";
import { parserFor } from "./parsers/index.js";
import { validateClaim } from "./validate.js";

const EVIDENCE_FILE = path.join(LEDGER_DIR, "evidence.jsonl");
const CLAIMS_FILE = path.join(LEDGER_DIR, "claims.jsonl");
const BASELINE_FILE = path.join(LEDGER_DIR, "schema-baselines.json");

export async function ingestPayload(payload, sourceName, observedAt = new Date().toISOString()) {
  await ensureDirs();
  const fingerprint = structuralFingerprint(payload);
  const payloadHash = stableHash(payload);
  const evidenceId = `ev_${stableHash([sourceName, payloadHash]).slice(0, 20)}`;
  const evidence = {
    evidence_id: evidenceId,
    source_name: sourceName,
    observed_at: observedAt,
    payload_hash: payloadHash,
    schema_fingerprint: fingerprint.hash,
    payload
  };
  await appendUniqueJsonl(EVIDENCE_FILE, evidence, "evidence_id");
  const parser = await parserFor(payload);
  const claims = parser(payload, {
    evidenceId,
    observedAt,
    schemaFingerprint: fingerprint.hash
  }).map((claim) => {
    validateClaim(claim);
    return {
      claim_id: `cl_${stableHash([claim.claim_type, claim.stable_activity_id, claim.actor_ref, claim.amount_usd, claim.authority, claim.person_id, claim.proof, claim.parser_version]).slice(0, 20)}`,
      revision_observed_at: observedAt,
      ...claim
    };
  });
  for (const claim of claims) await appendUniqueJsonl(CLAIMS_FILE, claim, "claim_id");
  return { evidence, claims, fingerprint };
}

export async function readLedger() {
  await ensureDirs();
  return {
    evidence: await readJsonl(EVIDENCE_FILE),
    claims: await readJsonl(CLAIMS_FILE)
  };
}

export async function resetLedger() {
  await ensureDirs();
  await clearFile(EVIDENCE_FILE);
  await clearFile(CLAIMS_FILE);
}

export async function currentState() {
  const { claims } = await readLedger();
  const activities = new Map();
  const identities = new Map();
  const people = new Map();
  const costs = new Map();

  for (const claim of claims) {
    if (claim.claim_type === "identity_resolved") {
      identities.set(actorKey(claim.actor_ref), claim);
      const existing = people.get(claim.person_id) ?? {};
      people.set(claim.person_id, { ...existing, ...claim });
    }
  }

  for (const claim of claims) {
    if (claim.claim_type === "activity_observed") {
      const previous = activities.get(claim.stable_activity_id);
      if (!previous || claim.observed_at >= previous.observed_at) activities.set(claim.stable_activity_id, { ...claim });
    }
    if (claim.claim_type === "cost_assigned") {
      const previous = costs.get(claim.stable_activity_id);
      if (!previous || rankCost(claim) >= rankCost(previous)) costs.set(claim.stable_activity_id, claim);
    }
  }

  const canonicalActivities = [...activities.values()].map((activity) => {
    const identity = identities.get(actorKey(activity.actor_ref));
    const person = identity ? people.get(identity.person_id) : null;
    const cost = costs.get(activity.stable_activity_id);
    return {
      ...activity,
      person_id: identity?.person_id ?? null,
      cost_center: identity?.cost_center ?? person?.cost_center ?? null,
      display_name: identity?.display_name ?? person?.display_name ?? null,
      identity_proof: identity?.proof ?? null,
      amount_usd: cost?.amount_usd ?? null,
      cost_authority: cost?.authority ?? null,
      completeness_state: cost ? "complete" : activity.completeness_state
    };
  });

  return { activities: canonicalActivities, identities: [...identities.values()], costs: [...costs.values()] };
}

export async function saveSchemaBaselines(entries) {
  await writeJson(BASELINE_FILE, entries);
}

export async function readSchemaBaselines() {
  try {
    const { readJson } = await import("./util.js");
    return await readJson(BASELINE_FILE);
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

export function actorKey(actorRef) {
  return `${actorRef?.kind ?? "unknown"}:${actorRef?.value ?? ""}`.toLowerCase();
}

function rankCost(claim) {
  const authorityRank = { invoice_export: 3, source_payload: 2, billing: 2, estimated: 1 };
  return authorityRank[claim.authority] ?? 0;
}
