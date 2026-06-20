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
    if (message.type === "result") {
      if (message.subtype === "success" && (message as any).structured_output) {
        structured = (message as any).structured_output;
      }
    }
  }
  if (structured === undefined) {
    log.error(scope, "no structured output returned");
    throw new Error(`[${scope}] no structured output returned`);
  }
  log.info(scope, "completed");
  return opts.schema.parse(structured); // typed + validated at the boundary
}

/** Same as runStage but returns the raw final text (for free-form output like the email). */
export async function runStageText(opts: {
  system: string;
  prompt: string;
  allowedTools?: string[];
  maxTurns?: number;
  label?: string;
}): Promise<string> {
  const scope = opts.label ?? "stage";
  log.info(scope, "started");
  let text = "";
  for await (const message of query({
    prompt: opts.prompt,
    options: {
      systemPrompt: opts.system,
      allowedTools: opts.allowedTools,
      maxTurns: opts.maxTurns,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      env: BASE_ENV,
    } as any,
  })) {
    traceMessage(scope, message);
    if (message.type === "result" && message.subtype === "success") {
      text = (message as any).result ?? text;
    }
  }
  if (!text) {
    log.error(scope, "no text returned");
    throw new Error(`[${scope}] no text returned`);
  }
  log.info(scope, "completed");
  return text;
}
