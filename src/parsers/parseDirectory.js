export function parseDirectory(payload, context) {
  const emailClaims = payload.people.map((person) => ({
    claim_type: "identity_resolved",
    actor_ref: { kind: "email", value: person.email },
    person_id: person.personId,
    cost_center: person.costCenter,
    display_name: person.displayName,
    proof: "directory_email",
    observed_at: context.observedAt,
    source_observation_id: context.evidenceId
  }));

  const edgeClaims = payload.authoritativeEdges.map((edge) => ({
    claim_type: "identity_resolved",
    actor_ref: { kind: "handle", value: edge.handle },
    person_id: edge.personId,
    proof: edge.proof,
    observed_at: context.observedAt,
    source_observation_id: context.evidenceId
  }));

  return [...emailClaims, ...edgeClaims];
}
