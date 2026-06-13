import { pickFirst, stableHash } from "../util.js";

export function parseChatGpt(payload, context) {
  const conversation = payload.conversation ?? payload.thread;
  const messages = conversation.messages ?? conversation.turns ?? [];
  const firstUser = messages.find((message) => ["user", "human"].includes(message.role ?? message.speaker)) ?? messages[0];
  const lastMessage = messages.at(-1) ?? firstUser;
  const sourceActivityId = pickFirst(conversation.id, conversation.uuid);
  const occurredAt = pickFirst(firstUser?.createdAt, firstUser?.time, lastMessage?.createdAt, lastMessage?.time, context.observedAt);
  const actorEmail = pickFirst(conversation.user?.email, conversation.account?.primaryEmail);
  const inputTokens = pickFirst(conversation.usage?.inputTokens, conversation.metering?.tokensIn, 0);
  const outputTokens = pickFirst(conversation.usage?.outputTokens, conversation.metering?.tokensOut, 0);
  const stableActivityId = `act_${stableHash(["chatgpt", sourceActivityId]).slice(0, 20)}`;
  const claims = [
    {
      claim_type: "activity_observed",
      stable_activity_id: stableActivityId,
      source_observation_id: context.evidenceId,
      source: "chatgpt:web",
      source_activity_id: sourceActivityId,
      actor_ref: actorEmail ? { kind: "email", value: actorEmail } : { kind: "unknown", value: null },
      tool_ref: { vendor: "chatgpt", surface: "web", model: pickFirst(conversation.model, conversation.modelName, "unknown") },
      occurred_at: occurredAt,
      observed_at: context.observedAt,
      activity_type: "conversation",
      usage_measures: { input_tokens: inputTokens, output_tokens: outputTokens, messages: messages.length },
      content_refs: [
        {
          role: "prompt",
          preview: pickFirst(firstUser?.content, firstUser?.text, "").slice(0, 160)
        }
      ],
      completeness_state: conversation.usage?.costUsd === undefined ? "cost_pending" : "complete",
      parser_version: "chatgpt-web@2",
      schema_fingerprint: context.schemaFingerprint
    }
  ];

  if (conversation.usage?.costUsd !== undefined) {
    claims.push({
      claim_type: "cost_assigned",
      stable_activity_id: stableActivityId,
      amount_usd: Number(conversation.usage.costUsd),
      authority: "source_payload",
      observed_at: context.observedAt
    });
  }

  return claims;
}
