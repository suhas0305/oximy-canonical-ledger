import { parseChatGpt } from "./parseChatGpt.js";
import { parseCursor } from "./parseCursor.js";
import { parseBilling } from "./parseBilling.js";
import { parseDirectory } from "./parseDirectory.js";
import { configParserFor } from "../configMapper.js";

export async function parserFor(payload) {
  if (payload.vendor === "chatgpt" && payload.surface === "web") return parseChatGpt;
  if (payload.vendor === "cursor" && payload.surface === "cli") return parseCursor;
  if (payload.surface === "billing") return parseBilling;
  if (payload.people && payload.authoritativeEdges) return parseDirectory;
  const configuredParser = await configParserFor(payload);
  if (configuredParser) return configuredParser;
  throw new Error(`No parser for payload ${payload.vendor ?? "unknown"}/${payload.surface ?? "unknown"}`);
}
