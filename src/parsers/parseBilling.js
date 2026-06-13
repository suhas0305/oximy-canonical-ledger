import { stableHash } from "../util.js";

export function parseBilling(payload, context) {
  return payload.allocations.map((allocation) => ({
    claim_type: "cost_assigned",
    stable_activity_id: `act_${stableHash([payload.vendor, allocation.conversationId]).slice(0, 20)}`,
    amount_usd: Number(allocation.costUsd),
    authority: allocation.source ?? "billing",
    billing_period: payload.period,
    observed_at: context.observedAt,
    source_observation_id: context.evidenceId
  }));
}
