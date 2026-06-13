import { stableHash } from "./util.js";

export function structuralFingerprint(payload) {
  const paths = [];
  walk(payload, "$", paths);
  paths.sort((a, b) => a.path.localeCompare(b.path));
  return {
    hash: stableHash(paths).slice(0, 20),
    paths
  };
}

export function compareFingerprints(previous, current) {
  const before = new Map(previous.paths.map((entry) => [entry.path, entry]));
  const after = new Map(current.paths.map((entry) => [entry.path, entry]));
  const added = [];
  const removed = [];
  const typeChanged = [];

  for (const [path, entry] of after) {
    if (!before.has(path)) added.push(entry);
    else if (before.get(path).type !== entry.type) typeChanged.push({ path, before: before.get(path).type, after: entry.type });
  }
  for (const [path, entry] of before) {
    if (!after.has(path)) removed.push(entry);
  }

  return {
    same: added.length === 0 && removed.length === 0 && typeChanged.length === 0,
    severity: driftSeverity({ added, removed, typeChanged }),
    added,
    removed,
    typeChanged
  };
}

function driftSeverity(report) {
  if (report.typeChanged.length) return "critical";
  if (report.removed.some((entry) => leafName(entry.path).match(/id|email|user|cost|usage|token|time|model/i))) return "critical";
  if (report.removed.length) return "warning";
  if (report.added.length) return "info";
  return "none";
}

function leafName(path) {
  return path.split(".").at(-1) ?? path;
}

function walk(value, path, paths) {
  const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  paths.push({ path, type });
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[]`, paths));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walk(child, `${path}.${key}`, paths);
    }
  }
}
