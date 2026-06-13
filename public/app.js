const metricsEl = document.querySelector("#metrics");
const rowsEl = document.querySelector("#activityRows");
const gatesEl = document.querySelector("#gates");
const verdictEl = document.querySelector("#verdict");
const coverageEl = document.querySelector("#coverage");
const coverageCountEl = document.querySelector("#coverageCount");
const typeGridEl = document.querySelector("#typeGrid");
const typeCountEl = document.querySelector("#typeCount");
const teamGridEl = document.querySelector("#teamGrid");
const costCenterCountEl = document.querySelector("#costCenterCount");
const statusEl = document.querySelector("#status");
const diffBox = document.querySelector("#diffBox");
const driftBox = document.querySelector("#driftBox");

document.querySelector("#seedBtn").addEventListener("click", async () => {
  await runAction("Seeded sample events", async () => {
    const data = await post("/api/seed");
    const typeData = await get("/api/activity-types");
    renderState(data, typeData.types);
  });
});

document.querySelector("#replayBtn").addEventListener("click", async () => {
  await runAction("Reality diff completed", async () => {
    const data = await post("/api/replay");
    diffBox.textContent = JSON.stringify(data, null, 2);
    await refresh();
  });
});

document.querySelector("#checkBtn").addEventListener("click", async () => {
  await runAction("Production check completed", async () => {
    const [data, typeData] = await Promise.all([get("/api/check"), get("/api/activity-types")]);
    renderGates(data);
    renderState(data, typeData.types);
  });
});

document.querySelector("#driftBtn").addEventListener("click", async () => {
  await runAction("Drift report loaded", async () => {
    const data = await get("/api/drift");
    driftBox.textContent = JSON.stringify(trimDrift(data), null, 2);
  });
});

await runAction("Dashboard ready", async () => {
  await refresh();
  const initialCheck = await get("/api/check");
  renderGates(initialCheck);
  const typeData = await get("/api/activity-types");
  renderState(initialCheck, typeData.types);
});

setInterval(() => {
  refresh().catch(() => {});
}, 5000);

async function refresh() {
  const [data, typeData] = await Promise.all([get("/api/state"), get("/api/activity-types")]);
  renderState(data, typeData.types);
}

function renderState(data, types) {
  renderMetrics(data.metrics);
  renderActivities(data.activities);
  renderActivityTypes(types, data.metrics.by_activity_type ?? {});
  renderCostCenters(data.metrics.by_cost_center ?? {});
}

function renderMetrics(metrics) {
  const previous = readCurrentMetrics();
  const items = [
    ["Active Users", metrics.active_users],
    ["Actor Refs", metrics.active_actor_refs],
    ["Activities", metrics.activities],
    ["Unresolved", metrics.unresolved_activities],
    ["Total Cost", `$${metrics.total_cost_usd.toFixed(4)}`]
  ];
  metricsEl.innerHTML = items.map(([label, value]) => {
    const changed = previous[label] !== undefined && String(previous[label]) !== String(value);
    return `<div class="metric ${changed ? "changed" : ""}" data-label="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${changed ? "<small>updated</small>" : ""}</div>`;
  }).join("");
}

function readCurrentMetrics() {
  return Object.fromEntries([...metricsEl.querySelectorAll(".metric")].map((node) => {
    const label = node.dataset.label;
    const value = node.querySelector("strong")?.textContent ?? "";
    return [label, value];
  }));
}

function renderActivities(activities) {
  rowsEl.innerHTML = activities.map((activity) => `
    <tr>
      <td>${escapeHtml(new Date(activity.occurred_at).toLocaleString())}</td>
      <td><span class="typeBadge">${escapeHtml(labelize(activity.activity_type))}</span></td>
      <td><span class="badge">${escapeHtml(activity.tool_ref.vendor)}</span><br>${escapeHtml(activity.tool_ref.surface)} / ${escapeHtml(activity.tool_ref.model)}</td>
      <td>${escapeHtml(activity.actor_ref.kind)}:${escapeHtml(activity.actor_ref.value ?? "unknown")}</td>
      <td>${escapeHtml(activity.person_id ?? "unresolved")}<br>${escapeHtml(activity.cost_center ?? "")}</td>
      <td>${activity.amount_usd == null ? "pending" : `$${Number(activity.amount_usd).toFixed(4)}`}<br>${escapeHtml(activity.cost_authority ?? "")}</td>
      <td>${escapeHtml(activity.completeness_state)}</td>
    </tr>
  `).join("");
}

function renderActivityTypes(types, counts) {
  const covered = types.filter((entry) => counts[entry.type]?.activities > 0);
  typeCountEl.textContent = `${covered.length}/${types.length} covered`;
  typeGridEl.innerHTML = types.map((entry) => {
    const count = counts[entry.type]?.activities ?? 0;
    return `
      <article class="typeCard ${count ? "covered" : "missing"}">
        <div>
          <strong>${escapeHtml(entry.label)}</strong>
          <span>${count ? `${count} events` : "No events"}</span>
        </div>
        <p>${escapeHtml(entry.description)}</p>
      </article>
    `;
  }).join("");
}

function renderCostCenters(costCenters) {
  const entries = Object.entries(costCenters).sort((a, b) => b[1].activities - a[1].activities);
  costCenterCountEl.textContent = `${entries.length} teams`;
  teamGridEl.innerHTML = entries.map(([name, value]) => `
    <article class="teamCard">
      <strong>${escapeHtml(name)}</strong>
      <span>${value.activities} activities</span>
      <p>$${Number(value.cost_usd).toFixed(4)} spend</p>
    </article>
  `).join("");
}

function labelize(value) {
  return String(value ?? "unknown").replaceAll("_", " ");
}

function renderGates(report) {
  renderVerdict(report);
  renderCoverage(report);
  gatesEl.innerHTML = `
    <div class="gateSummary ${report.passed ? "pass" : "fail"}">
      <strong>${report.passed ? "Production gates passing" : "Production gates failing"}</strong>
      <span>${report.gates.filter((gate) => gate.passed).length}/${report.gates.length} requirements satisfied</span>
    </div>
    ${report.gates.map((gate) => `
      <div class="gate ${gate.passed ? "pass" : "fail"}">
        <strong>${escapeHtml(gate.name.replaceAll("_", " "))}</strong>
        <span>${escapeHtml(gate.evidence)}</span>
      </div>
    `).join("")}
  `;
}

function renderVerdict(report) {
  verdictEl.className = `verdict ${report.passed ? "pass" : "fail"}`;
  verdictEl.innerHTML = `
    <div>
      <span class="eyebrow">Canonical Event Readiness</span>
      <strong>${report.passed ? "All canonical-event requirements are satisfied" : "Some canonical-event requirements need work"}</strong>
    </div>
    <div class="verdictScore">${report.gates.filter((gate) => gate.passed).length}/${report.gates.length}</div>
  `;
}

function renderCoverage(report) {
  const passed = new Set(report.gates.filter((gate) => gate.passed).map((gate) => gate.name));
  const groups = [
    {
      title: "One Canonical Event",
      text: "Every reader consumes the same canonical activity shape.",
      gates: ["canonical_event_shape", "narrow_reader_contract"]
    },
    {
      title: "Incompatible Sources",
      text: "Different vendors and ChatGPT web/API surfaces normalize cleanly.",
      gates: ["same_vendor_multi_surface", "config_driven_source", "drift_detection"]
    },
    {
      title: "Late Facts And Cost",
      text: "Incomplete events stay reportable and cost backfills later by stable key.",
      gates: ["late_cost_backfill", "incomplete_events_allowed"]
    },
    {
      title: "Redelivery And Dedup",
      text: "Repeated payloads do not double-count activity or duplicate ledger rows.",
      gates: ["append_only_idempotency", "stable_dedup_key"]
    },
    {
      title: "Identity Later",
      text: "Events ingest with actor refs, then resolve to people after directory evidence arrives.",
      gates: ["late_identity_resolution", "raw_evidence_preserved"]
    }
  ].map((group) => ({
    ...group,
    passed: group.gates.every((gate) => passed.has(gate))
  }));

  coverageCountEl.textContent = `${groups.filter((group) => group.passed).length}/${groups.length} satisfied`;
  coverageEl.innerHTML = groups.map((group) => `
    <article class="coverageCard ${group.passed ? "pass" : "fail"}">
      <span>${group.passed ? "Satisfied" : "Needs work"}</span>
      <strong>${escapeHtml(group.title)}</strong>
      <p>${escapeHtml(group.text)}</p>
    </article>
  `).join("");
}

function trimDrift(data) {
  return {
    baseline_hash: data.baseline_hash,
    current_hash: data.current_hash,
    removed_paths: data.report.removed.slice(0, 20),
    added_paths: data.report.added.slice(0, 20),
    type_changes: data.report.typeChanged
  };
}

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function post(url) {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function runAction(successMessage, fn) {
  statusEl.textContent = "Working...";
  statusEl.className = "status";
  try {
    await fn();
    statusEl.textContent = successMessage;
    statusEl.className = "status ok";
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.className = "status error";
    throw error;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
