import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const SAMPLE_DIR = path.join(DATA_DIR, "samples");
export const LEDGER_DIR = path.join(DATA_DIR, "ledger");

export function stableHash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function ensureDirs() {
  await mkdir(LEDGER_DIR, { recursive: true });
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function appendJsonl(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export async function appendUniqueJsonl(filePath, value, keyName) {
  const rows = await readJsonl(filePath);
  if (rows.some((row) => row[keyName] === value[keyName])) return false;
  await appendJsonl(filePath, value);
  return true;
}

export async function clearFile(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "", "utf8");
}

export async function readJsonl(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function listSampleFiles() {
  const files = await readdir(SAMPLE_DIR);
  return files.filter((file) => file.endsWith(".json")).map((file) => path.join(SAMPLE_DIR, file));
}

export function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}
