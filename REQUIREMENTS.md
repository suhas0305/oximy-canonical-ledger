# Requirements

This file maps the canonical-event requirements to the implemented system and the checks that prove them.

Run:

```powershell
npm run check
```

Expected result:

```text
passed: true
```

## Requirement Checklist

| Requirement | Status | Implementation |
|---|---:|---|
| Everything maps into one event shape | Satisfied | All sources emit canonical `activity_observed` claims. |
| Every reader reads only from the canonical event | Satisfied | `src/metrics.js` reads canonical activities from `currentState()`, not raw payloads. |
| Next AI tool is a config change | Satisfied | Config maps in `data/source-maps/*.json` can onboard sources without parser code. |
| Sources arrive in incompatible shapes | Satisfied | ChatGPT web, ChatGPT API, Cursor CLI, billing, directory, and several config-only tools normalize into one model. |
| Same vendor emits different schemas across surfaces | Satisfied | ChatGPT web and ChatGPT API both map into the same canonical shape. |
| Abstraction is narrow enough to mean something | Satisfied | Required canonical claim fields are validated in `src/validate.js`. |
| Abstraction is total enough to hold every source without loss | Satisfied | Raw evidence is preserved in `data/ledger/evidence.jsonl` and linked by `source_observation_id`. |
| Source-specific assumptions do not leak into readers | Satisfied | Source logic lives in parsers/config maps; readers consume canonical state only. |
| Facts arrive late | Satisfied | Cost and identity are separate claims that can arrive after activity ingest. |
| Cost can be missing, delayed, or out of band | Satisfied | Activities can start as `cost_pending`; later `cost_assigned` claims backfill cost. |
| Events stay revisable on a stable key | Satisfied | `stable_activity_id` links revisions and late claims. |
| Append-only storage is respected | Satisfied | Evidence and claims are appended; current truth is computed from the ledger. |
| Redelivery does not double-count | Satisfied | `appendUniqueJsonl` prevents duplicate evidence and claim rows by deterministic IDs. |
| Deterministic dedup key exists | Satisfied | Stable IDs are generated from source identity fields and source name. |
| Identity may not exist at ingest | Satisfied | Activities store `actor_ref`; later `identity_resolved` claims attach `person_id`. |
| Unresolved identity is explicit | Satisfied | Metrics expose `unresolved_activities`; unresolved rows are not silently collapsed. |
| Canonical activity types are covered | Satisfied | Nine canonical activity types are defined and seeded. |

## Production Gates

`src/qualityGates.js` runs these gates:

- `canonical_event_shape`
- `canonical_activity_type_taxonomy`
- `same_vendor_multi_surface`
- `config_driven_source`
- `narrow_reader_contract`
- `late_cost_backfill`
- `incomplete_events_allowed`
- `append_only_idempotency`
- `stable_dedup_key`
- `late_identity_resolution`
- `raw_evidence_preserved`
- `drift_detection`

All must pass for the app to show the canonical-event implementation as healthy.

## Canonical Claim Contract

### `activity_observed`

Required fields:

- `stable_activity_id`
- `source_observation_id`
- `source`
- `actor_ref`
- `tool_ref`
- `occurred_at`
- `observed_at`
- `activity_type`
- `usage_measures`
- `content_refs`
- `completeness_state`
- `parser_version`
- `schema_fingerprint`

### `cost_assigned`

Required fields:

- `stable_activity_id`
- `amount_usd`
- `authority`
- `observed_at`

### `identity_resolved`

Required fields:

- `actor_ref`
- `person_id`
- `proof`
- `observed_at`

## Canonical Activity Taxonomy

The system currently covers:

- `conversation`
- `completion`
- `code_assist`
- `image_generation`
- `embedding`
- `retrieval_search`
- `agent_tool_call`
- `document_analysis`
- `transcription`

The taxonomy is defined in `src/activityTypes.js`.

## Data Flow

```text
source payload
  -> evidence record
  -> parser or config map
  -> canonical claims
  -> current state
  -> metrics and dashboard
```

## Why This Satisfies The Problem

The system avoids per-reader source branching. Each source is handled once at the ingestion boundary, then everything downstream reads canonical activities.

Late facts are not forced into the original event. They are claims that revise the current view by stable key. This allows append-only storage while still producing corrected, current metrics.

Redelivery is handled by deterministic IDs. The same payload or claim does not create duplicate ledger rows, so ROI metrics do not double-count activity.

Identity is treated as evidence, not a guess. An activity can point at an email, handle, device, or account reference first. A later authoritative identity claim resolves it to a person.
