import { canonicalActivityTypeSet } from "./activityTypes.js";

const claimContracts = {
  activity_observed: [
    "stable_activity_id",
    "source_observation_id",
    "source",
    "actor_ref",
    "tool_ref",
    "occurred_at",
    "observed_at",
    "activity_type",
    "usage_measures",
    "content_refs",
    "completeness_state",
    "parser_version",
    "schema_fingerprint"
  ],
  cost_assigned: ["stable_activity_id", "amount_usd", "authority", "observed_at"],
  identity_resolved: ["actor_ref", "person_id", "proof", "observed_at"]
};

export function validateClaim(claim) {
  const required = claimContracts[claim.claim_type];
  if (!required) throw new Error(`Unknown claim_type: ${claim.claim_type}`);
  const missing = required.filter((key) => claim[key] === undefined || claim[key] === null || claim[key] === "");
  if (missing.length) throw new Error(`Invalid ${claim.claim_type} claim, missing: ${missing.join(", ")}`);
  if (claim.actor_ref && !["email", "handle", "device", "account", "unknown"].includes(claim.actor_ref.kind)) {
    throw new Error(`Invalid actor_ref.kind: ${claim.actor_ref.kind}`);
  }
  if (claim.tool_ref && !claim.tool_ref.vendor) throw new Error("tool_ref.vendor is required");
  if (claim.activity_type && !canonicalActivityTypeSet().has(claim.activity_type)) {
    throw new Error(`Unknown canonical activity_type: ${claim.activity_type}`);
  }
  if (claim.amount_usd !== undefined && (!Number.isFinite(Number(claim.amount_usd)) || Number(claim.amount_usd) < 0)) {
    throw new Error(`Invalid amount_usd: ${claim.amount_usd}`);
  }
  return true;
}

export function canonicalContract() {
  return claimContracts;
}
