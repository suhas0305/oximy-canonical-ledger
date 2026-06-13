export function computeMetrics(activities) {
  const activePeople = new Set();
  const activeActorRefs = new Set();
  let totalCost = 0;
  let unresolvedActivities = 0;
  const byTool = {};
  const byCostCenter = {};
  const byActivityType = {};

  for (const activity of activities) {
    if (activity.person_id) activePeople.add(activity.person_id);
    activeActorRefs.add(`${activity.actor_ref?.kind}:${activity.actor_ref?.value}`);
    if (!activity.person_id) unresolvedActivities += 1;
    if (activity.amount_usd !== null && activity.amount_usd !== undefined) totalCost += Number(activity.amount_usd);

    const tool = activity.tool_ref?.vendor ?? "unknown";
    byTool[tool] ??= { activities: 0, cost_usd: 0, unresolved: 0 };
    byTool[tool].activities += 1;
    byTool[tool].cost_usd += Number(activity.amount_usd ?? 0);
    if (!activity.person_id) byTool[tool].unresolved += 1;

    const costCenter = activity.cost_center ?? "Unresolved";
    byCostCenter[costCenter] ??= { activities: 0, cost_usd: 0 };
    byCostCenter[costCenter].activities += 1;
    byCostCenter[costCenter].cost_usd += Number(activity.amount_usd ?? 0);

    const activityType = activity.activity_type ?? "unknown";
    byActivityType[activityType] ??= { activities: 0, cost_usd: 0 };
    byActivityType[activityType].activities += 1;
    byActivityType[activityType].cost_usd += Number(activity.amount_usd ?? 0);
  }

  return {
    active_users: activePeople.size,
    active_actor_refs: activeActorRefs.size,
    activities: activities.length,
    unresolved_activities: unresolvedActivities,
    total_cost_usd: round(totalCost),
    by_tool: Object.fromEntries(Object.entries(byTool).map(([key, value]) => [key, { ...value, cost_usd: round(value.cost_usd) }])),
    by_cost_center: Object.fromEntries(Object.entries(byCostCenter).map(([key, value]) => [key, { ...value, cost_usd: round(value.cost_usd) }])),
    by_activity_type: Object.fromEntries(Object.entries(byActivityType).map(([key, value]) => [key, { ...value, cost_usd: round(value.cost_usd) }]))
  };
}

export function realityDiff(before, after) {
  return {
    active_users: delta(before.active_users, after.active_users),
    active_actor_refs: delta(before.active_actor_refs, after.active_actor_refs),
    activities: delta(before.activities, after.activities),
    unresolved_activities: delta(before.unresolved_activities, after.unresolved_activities),
    total_cost_usd: delta(before.total_cost_usd, after.total_cost_usd)
  };
}

function delta(before, after) {
  return { before, after, change: round(after - before) };
}

function round(value) {
  return Math.round(Number(value) * 10000) / 10000;
}
