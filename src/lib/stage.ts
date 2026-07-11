import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { log } from "@/lib/logger";

type McpServers = Record<string, unknown>;

const BASE_ENV = { ...process.env, ENABLE_TOOL_SEARCH: "auto" };

// Trace one streamed message: an agent's reasoning text or a tool call.
// This is what lets the log file reconstruct exactly what each stage did.
function traceMessage(scope: string, message: any): void {
  if (message.type === "assistant" && message.message?.content) {
    for (const block of message.message.content) {
      if ("text" in block && block.text.trim()) {
        log.info(scope, `reasoning: ${block.text.trim()}`);
      } else if ("name" in block) {
        const input = "input" in block ? JSON.stringify(block.input).slice(0, 300) : "";
        log.info(scope, `tool → ${block.name} ${input}`);
      }
    }
  } else if (message.type === "result") {
    log.info(scope, `result: ${message.subtype}`);
  }
}

// Extract a JSON object/array from free-form result text. The agent sometimes
// returns its JSON as the final text answer rather than via structured_output
// (especially after tool use), so we strip markdown fences and grab the first
// {...} or [...] block. Used as a fallback before giving up.
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.search(/[[{]/);
    const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return undefined;
  }
}

/**
 * Run ONE agent stage as a self-contained query() and return its result.
 *
 * Each stage is its own top-level query, so the SDK validates the final output
 * against `schema` (json_schema outputFormat, re-prompting on mismatch) — this
 * makes the stage→stage handover code-enforced, not prompt-hoped. Running each
 * stage in code (rather than one orchestrator delegating to subagents) is also
 * what lets us hardcode parallelism with Promise.all.
 */
export async function runStage<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  mcpServers?: McpServers;
  allowedTools?: string[];
  maxTurns?: number;
  label?: string;
}): Promise<T> {
  const scope = opts.label ?? "stage";
  log.info(scope, "started");
  let structured: unknown;
  let resultText = "";
  for await (const message of query({
    prompt: opts.prompt,
    options: {
      systemPrompt: opts.system,
      mcpServers: opts.mcpServers as any,
      allowedTools: opts.allowedTools,
      maxTurns: opts.maxTurns,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      outputFormat: { type: "json_schema", schema: z.toJSONSchema(opts.schema) as any },
      env: BASE_ENV,
    } as any,
  })) {
    traceMessage(scope, message);
    if (message.type === "result" && message.subtype === "success") {
      structured = (message as any).structured_output ?? structured;
      resultText = (message as any).result ?? resultText;
    }
  }

  // Prefer the SDK's validated structured_output; fall back to parsing JSON out
  // of the final text (the SDK doesn't always populate structured_output after
  // tool use). Either way we zod-parse, so the typed guarantee holds.
  let data = structured;
  if (data === undefined && resultText) {
    data = extractJson(resultText);
    if (data !== undefined) log.warn(scope, "used JSON-from-text fallback (no structured_output)");
  }
  if (data === undefined) {
    log.error(scope, "no parseable output returned");
    throw new Error(`[${scope}] no parseable output returned`);
  }
  log.info(scope, "completed");
  return opts.schema.parse(data); // typed + validated at the boundary
}
