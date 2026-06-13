# Oximy Canonical Event Ledger

A local reference implementation for the canonical AI usage event problem:

> Every AI source maps into one event shape. Every metric reads only from that shape. Late facts such as cost and identity arrive as append-only claims on stable keys.

The app runs entirely on free local tooling:

- Node.js built-ins only
- no npm package install
- no paid APIs
- no external database
- JSONL files under `data/ledger`
- vanilla HTML, CSS, and JavaScript dashboard

## Quick Start

From this folder:

```powershell
npm run seed
npm run check
npm run serve
```

Open:

```text
http://localhost:4317
```

If the browser still shows old numbers, hard refresh:

```text
Ctrl + Shift + R
```

## Current Demo State

After `npm run seed`, the demo contains:

```text
Active Users: 4
Actor Refs: 5
Activities: 11
Unresolved: 0
Total Cost: $0.2089
Canonical Activity Types: 9/9 covered
```

The seeded users are:

```text
Maya Singh    Security
Priya Rao     Legal
Omar Chen     Marketing
Lena Ortiz    Platform
```

## Commands

```powershell
npm run seed
```

Rebuilds the local ledger from sample payloads in `data/samples`.

```powershell
npm run check
```

Runs the production gates. This verifies canonical shape, activity type coverage, config-driven source onboarding, late cost backfill, deduplication, identity resolution, raw evidence preservation, and drift detection.

```powershell
npm run drift
```

Compares ChatGPT schema generations and reports structural drift.

```powershell
npm run replay
```

Replays sample payloads and shows a before/after Reality Diff.

```powershell
npm test
```

Runs the Node test suite.

```powershell
npm run serve
```

Starts the local dashboard at `http://localhost:4317`.

## How It Works

The system is built around three layers:

```text
raw evidence -> canonical claims -> current state and metrics
```

### 1. Raw Evidence

Every source payload is stored as evidence in `data/ledger/evidence.jsonl`.

Each evidence record includes:

- `evidence_id`
- `source_name`
- `observed_at`
- `payload_hash`
- `schema_fingerprint`
- original raw `payload`

This preserves the source without loss. If a parser changes later, the raw payload can be replayed.

### 2. Canonical Claims

Parsers and config maps emit canonical claims into `data/ledger/claims.jsonl`.

The main claim types are:

- `activity_observed`
- `cost_assigned`
- `identity_resolved`

An activity can be born incomplete. For example, Cursor usage can arrive with `cost_pending`, then a later billing claim can attach cost on the same `stable_activity_id`.

### 3. Current State

`src/ledger.js` reads the append-only claims and computes current truth:

- latest activity per `stable_activity_id`
- strongest cost claim per activity
- identity resolution from `actor_ref` to `person_id`
- cost center and display name enrichment

Metrics never read raw vendor payloads. They read only canonical activities from current state.

## Canonical Activity Types

The taxonomy lives in `src/activityTypes.js`.

The current canonical activity types are:

- `conversation`
- `completion`
- `code_assist`
- `image_generation`
- `embedding`
- `retrieval_search`
- `agent_tool_call`
- `document_analysis`
- `transcription`

The dashboard shows coverage for all nine types.

## Adding A New AI Tool

For most sources, add a config file in:

```text
data/source-maps
```

Example:

```text
data/source-maps/chatgpt-api.json
```

Then add a matching sample payload in:

```text
data/samples
```

Run:

```powershell
npm run seed
npm run check
```

If the source fits the config mapper, no parser code is needed. If the payload is too unusual, add a parser under `src/parsers`.

## Important Files

```text
src/ledger.js           append-only evidence and claim ledger
src/configMapper.js     config-driven source mapping
src/activityTypes.js    canonical activity taxonomy
src/qualityGates.js     production requirement checks
src/metrics.js          one canonical metrics implementation
src/drift.js            structural drift fingerprinting
src/server.js           local API and static dashboard server
public/app.js           dashboard behavior
public/styles.css       dashboard UI
data/samples            source payload fixtures
data/source-maps        config-driven source adapters
data/ledger             generated local ledger files
```

## Production Notes

This implementation proves the logic locally. For a real enterprise deployment, replace JSONL with a durable transactional append-only store and add:

- authentication and authorization
- encryption at rest
- request audit logs
- backup and restore
- retention policy
- tenant isolation
- monitoring and alerting
- deployment packaging
- migration controls

The canonical-event model, parser boundaries, dedup strategy, late-claim structure, and metric discipline are already represented here.
